const { sql, poolPromise } = require('../config/db');

const SELECT = `
  SELECT n.*, a.email AS handled_by_email
  FROM notifications n
  LEFT JOIN admin_users a ON a.id = n.handled_by
`;

async function findById(id) {
  const pool = await poolPromise;
  const result = await pool.request().input('id', sql.Int, id).query(`${SELECT} WHERE n.id = @id`);
  return result.recordset[0] || null;
}

async function create({ restaurant_id, type, title, body, entity_type, entity_id }) {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('restaurant_id', sql.Int, restaurant_id)
    .input('type', sql.NVarChar(40), type)
    .input('title', sql.NVarChar(150), title)
    .input('body', sql.NVarChar(500), body || null)
    .input('entity_type', sql.NVarChar(60), entity_type || null)
    .input('entity_id', sql.Int, entity_id || null)
    .query(`
      INSERT INTO notifications (restaurant_id, type, title, body, entity_type, entity_id)
      OUTPUT INSERTED.id
      VALUES (@restaurant_id, @type, @title, @body, @entity_type, @entity_id)
    `);
  return findById(result.recordset[0].id);
}

async function findAll({ unreadOnly, excludeTypes = [], limit = 200, before } = {}) {
  const pool = await poolPromise;
  const request = pool.request().input('limit', sql.Int, limit);
  const where = [];
  if (before) {
    where.push('n.id < @before');
    request.input('before', sql.Int, before);
  }
  if (unreadOnly) where.push('n.is_read = 0');
  excludeTypes.forEach((type, i) => {
    request.input(`ex${i}`, sql.NVarChar(40), type);
    where.push(`n.type <> @ex${i}`);
  });
  const result = await request.query(`SELECT TOP (@limit) * FROM (${SELECT} ${where.length ? `WHERE ${where.join(' AND ')}` : ''}   ) AS x ORDER BY x.created_at DESC, x.id DESC`);
  return result.recordset;
}

// Eyni masa üçün hələ həll olunmamış çağırış/hesab sorğusu (təkrar basmada dublikat yaranmasın)
async function findUnresolved(type, entityType, entityId) {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('type', sql.NVarChar(40), type)
    .input('et', sql.NVarChar(60), entityType)
    .input('eid', sql.Int, entityId)
    .query(`${SELECT} WHERE n.type = @type AND n.entity_type = @et AND n.entity_id = @eid AND n.status <> N'RESOLVED'`);
  return result.recordset[0] || null;
}

async function markRead(id) {
  const pool = await poolPromise;
  await pool.request().input('id', sql.Int, id).query('UPDATE notifications SET is_read = 1 WHERE id = @id');
  return findById(id);
}

async function setStatus(id, status, adminId) {
  const pool = await poolPromise;
  await pool.request()
    .input('id', sql.Int, id)
    .input('status', sql.NVarChar(20), status)
    .input('admin', sql.Int, adminId || null)
    .query('UPDATE notifications SET status = @status, handled_by = @admin, handled_at = SYSUTCDATETIME(), is_read = 1 WHERE id = @id');
  return findById(id);
}

async function markAllRead() {
  const pool = await poolPromise;
  await pool.request().query('UPDATE notifications SET is_read = 1 WHERE is_read = 0');
}

async function remove(id) {
  const pool = await poolPromise;
  const result = await pool.request().input('id', sql.Int, id).query('DELETE FROM notifications WHERE id = @id');
  return result.rowsAffected[0] > 0;
}

// Oxunmuş, lakin hələ həll olunmamış çağırış/hesab sorğuları silinmir — işçi unuda bilər
async function removeAllRead() {
  const pool = await poolPromise;
  await pool.request().query(`DELETE FROM notifications WHERE is_read = 1 AND NOT (type IN (N'call_waiter', N'request_bill') AND status <> N'RESOLVED')`);
}

module.exports = { findById, create, findAll, findUnresolved, markRead, setStatus, markAllRead, remove, removeAllRead };
