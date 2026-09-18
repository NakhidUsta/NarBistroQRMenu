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
    .query('SELECT id, restaurant_id, email, role, created_at FROM admin_users WHERE id = @id');
  return result.recordset[0] || null;
}

async function findAll() {
  const pool = await poolPromise;
  const result = await pool.request().query('SELECT id, email, role, created_at FROM admin_users ORDER BY id ASC');
  return result.recordset;
}

async function create({ restaurant_id, email, password_hash, role }) {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('restaurant_id', sql.Int, restaurant_id)
    .input('email', sql.NVarChar(150), email)
    .input('password_hash', sql.NVarChar(sql.MAX), password_hash)
    .input('role', sql.NVarChar(20), role)
    .query(`
      INSERT INTO admin_users (restaurant_id, email, password_hash, role)
      OUTPUT INSERTED.id, INSERTED.email, INSERTED.role, INSERTED.created_at
      VALUES (@restaurant_id, @email, @password_hash, @role)
    `);
  return result.recordset[0];
}

async function update(id, { role, password_hash }) {
  const pool = await poolPromise;
  const request = pool.request()
    .input('id', sql.Int, id)
    .input('role', sql.NVarChar(20), role);
  let set = 'role = @role';
  if (password_hash) {
    set += ', password_hash = @password_hash';
    request.input('password_hash', sql.NVarChar(sql.MAX), password_hash);
  }
  const result = await request.query(`
    UPDATE admin_users SET ${set}
    OUTPUT INSERTED.id, INSERTED.email, INSERTED.role, INSERTED.created_at
    WHERE id = @id
  `);
  return result.recordset[0] || null;
}

async function remove(id) {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('id', sql.Int, id)
    .query('DELETE FROM admin_users WHERE id = @id');
  return result.rowsAffected[0] > 0;
}

async function countByRole(role) {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('role', sql.NVarChar(20), role)
    .query('SELECT COUNT(*) AS n FROM admin_users WHERE role = @role');
  return result.recordset[0].n;
}

module.exports = { findByEmail, findById, findAll, create, update, remove, countByRole };
