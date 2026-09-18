const { sql, poolPromise } = require('../config/db');

async function insert({ admin_user_id, action, entity_type, entity_id, before_json, after_json, ip_address }) {
  const pool = await poolPromise;
  await pool.request()
    .input('admin_user_id', sql.Int, admin_user_id || null)
    .input('action', sql.NVarChar(60), action)
    .input('entity_type', sql.NVarChar(60), entity_type)
    .input('entity_id', sql.NVarChar(60), entity_id == null ? null : String(entity_id))
    .input('before_json', sql.NVarChar(sql.MAX), before_json || null)
    .input('after_json', sql.NVarChar(sql.MAX), after_json || null)
    .input('ip_address', sql.NVarChar(64), ip_address || null)
    .query(`
      INSERT INTO audit_logs (admin_user_id, action, entity_type, entity_id, before_json, after_json, ip_address)
      VALUES (@admin_user_id, @action, @entity_type, @entity_id, @before_json, @after_json, @ip_address)
    `);
}

async function findRecent({ limit = 200, entity_type } = {}) {
  const pool = await poolPromise;
  const request = pool.request().input('limit', sql.Int, limit);
  let where = '';
  if (entity_type) {
    where = 'WHERE a.entity_type = @entity_type';
    request.input('entity_type', sql.NVarChar(60), entity_type);
  }
  const result = await request.query(`
    SELECT TOP (@limit) a.id, a.admin_user_id, u.email AS admin_email, a.action, a.entity_type,
           a.entity_id, a.before_json, a.after_json, a.created_at
    FROM audit_logs a
    LEFT JOIN admin_users u ON u.id = a.admin_user_id
    ${where}
    ORDER BY a.created_at DESC
  `);
  return result.recordset;
}

module.exports = { insert, findRecent };
