const { sql, poolPromise } = require('../config/db');

async function findByEmail(email) {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('email', sql.NVarChar(150), email)
    .query('SELECT id, restaurant_id, email, password_hash, role FROM admin_users WHERE email = @email');
  return result.recordset[0] || null;
}

async function findById(id) {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('id', sql.Int, id)
    .query('SELECT id, restaurant_id, email, role FROM admin_users WHERE id = @id');
  return result.recordset[0] || null;
}

module.exports = { findByEmail, findById };
