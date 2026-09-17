const { sql, poolPromise } = require('../config/db');

const SELECT_COLUMNS = `
  id, restaurant_id, label, code, capacity, qr_token, is_active,
  scan_count, last_scanned_at, created_at, updated_at
`;

async function findAll() {
  const pool = await poolPromise;
  const result = await pool.request().query(`SELECT ${SELECT_COLUMNS} FROM restaurant_tables ORDER BY id ASC`);
  return result.recordset;
}

async function findById(id) {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('id', sql.Int, id)
    .query(`SELECT ${SELECT_COLUMNS} FROM restaurant_tables WHERE id = @id`);
  return result.recordset[0] || null;
}

async function findByCode(code) {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('code', sql.NVarChar(40), code)
    .query(`SELECT ${SELECT_COLUMNS} FROM restaurant_tables WHERE code = @code`);
  return result.recordset[0] || null;
}

async function create({ restaurant_id, label, code, capacity, qr_token }) {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('restaurant_id', sql.Int, restaurant_id)
    .input('label', sql.NVarChar(40), label)
    .input('code', sql.NVarChar(40), code)
    .input('capacity', sql.Int, capacity ?? 2)
    .input('qr_token', sql.NVarChar(64), qr_token)
    .query(`
      INSERT INTO restaurant_tables (restaurant_id, label, code, capacity, qr_token)
      OUTPUT INSERTED.*
      VALUES (@restaurant_id, @label, @code, @capacity, @qr_token)
    `);
  return result.recordset[0];
}

async function update(id, { label, capacity, is_active }) {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('id', sql.Int, id)
    .input('label', sql.NVarChar(40), label)
    .input('capacity', sql.Int, capacity ?? 2)
    .input('is_active', sql.Bit, is_active === false ? 0 : 1)
    .query(`
      UPDATE restaurant_tables
      SET label = @label, capacity = @capacity, is_active = @is_active, updated_at = SYSUTCDATETIME()
      OUTPUT INSERTED.*
      WHERE id = @id
    `);
  return result.recordset[0] || null;
}

async function rotateQrToken(id, qr_token) {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('id', sql.Int, id)
    .input('qr_token', sql.NVarChar(64), qr_token)
    .query(`
      UPDATE restaurant_tables
      SET qr_token = @qr_token, updated_at = SYSUTCDATETIME()
      OUTPUT INSERTED.*
      WHERE id = @id
    `);
  return result.recordset[0] || null;
}

async function registerScan(code) {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('code', sql.NVarChar(40), code)
    .query(`
      UPDATE restaurant_tables
      SET scan_count = scan_count + 1, last_scanned_at = SYSUTCDATETIME()
      OUTPUT INSERTED.*
      WHERE code = @code
    `);
  return result.recordset[0] || null;
}

async function remove(id) {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('id', sql.Int, id)
    .query('DELETE FROM restaurant_tables WHERE id = @id');
  return result.rowsAffected[0] > 0;
}

module.exports = { findAll, findById, findByCode, create, update, rotateQrToken, registerScan, remove };
