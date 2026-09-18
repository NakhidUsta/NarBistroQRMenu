const { sql, poolPromise } = require('../config/db');

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
      OUTPUT INSERTED.*
      VALUES (@restaurant_id, @type, @title, @body, @entity_type, @entity_id)
    `);
  return result.recordset[0];
}

async function findAll({ unreadOnly } = {}) {
  const pool = await poolPromise;
  let query = 'SELECT * FROM notifications';
  if (unreadOnly) query += ' WHERE is_read = 0';
  query += ' ORDER BY created_at DESC';
  const result = await pool.request().query(query);
  return result.recordset;
}

async function markRead(id) {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('id', sql.Int, id)
    .query('UPDATE notifications SET is_read = 1 OUTPUT INSERTED.* WHERE id = @id');
  return result.recordset[0] || null;
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

async function removeAllRead() {
  const pool = await poolPromise;
  await pool.request().query('DELETE FROM notifications WHERE is_read = 1');
}

module.exports = { create, findAll, markRead, markAllRead, remove, removeAllRead };
