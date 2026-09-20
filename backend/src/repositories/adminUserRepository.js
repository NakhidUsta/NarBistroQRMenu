const { sql, poolPromise } = require('../config/db');

async function findByEmail(email) {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('email', sql.NVarChar(150), email)
    .query('SELECT id, restaurant_id, email, password_hash, role, token_version, failed_attempts, locked_until, email_verified_at FROM admin_users WHERE email = @email');
  return result.recordset[0] || null;
}

// Hər admin sorğusunda sessiyanın etibarlılığını (token versiyası, cari rol) yoxlamaq üçün.
async function findAuthState(id) {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('id', sql.Int, id)
    .query('SELECT id, restaurant_id, email, role, token_version, email_verified_at FROM admin_users WHERE id = @id');
  return result.recordset[0] || null;
}

async function registerFailure(id, maxAttempts, lockMinutes) {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('id', sql.Int, id)
    .input('max', sql.Int, maxAttempts)
    .input('minutes', sql.Int, lockMinutes)
    .query(`
      UPDATE admin_users
      SET failed_attempts = failed_attempts + 1,
          locked_until = CASE WHEN failed_attempts + 1 >= @max THEN DATEADD(MINUTE, @minutes, SYSUTCDATETIME()) ELSE locked_until END
      OUTPUT INSERTED.failed_attempts, INSERTED.locked_until
      WHERE id = @id
    `);
  return result.recordset[0];
}

async function setEmailVerified(id) {
  const pool = await poolPromise;
  await pool.request().input('id', sql.Int, id).query('UPDATE admin_users SET email_verified_at = COALESCE(email_verified_at, SYSUTCDATETIME()) WHERE id = @id');
}

// E-poçtu dəyişir; yeni ünvan təsdiqlənənə qədər "təsdiqlənməyib" olur
async function updateEmail(id, email) {
  const pool = await poolPromise;
  await pool.request()
    .input('id', sql.Int, id)
    .input('email', sql.NVarChar(150), email)
    .query('UPDATE admin_users SET email = @email, email_verified_at = NULL WHERE id = @id');
}

async function resetFailures(id) {
  const pool = await poolPromise;
  await pool.request().input('id', sql.Int, id)
    .query('UPDATE admin_users SET failed_attempts = 0, locked_until = NULL WHERE id = @id AND (failed_attempts > 0 OR locked_until IS NOT NULL)');
}

// Şifrəni dəyişir və token versiyasını artırır → bütün köhnə sessiyalar etibarsız olur.
async function updatePassword(id, password_hash) {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('id', sql.Int, id)
    .input('hash', sql.NVarChar(sql.MAX), password_hash)
    .query(`
      UPDATE admin_users SET password_hash = @hash, token_version = token_version + 1, failed_attempts = 0, locked_until = NULL
      OUTPUT INSERTED.token_version WHERE id = @id
    `);
  return result.recordset[0]?.token_version;
}

async function bumpTokenVersion(id) {
  const pool = await poolPromise;
  const result = await pool.request().input('id', sql.Int, id)
    .query('UPDATE admin_users SET token_version = token_version + 1 OUTPUT INSERTED.token_version WHERE id = @id');
  return result.recordset[0]?.token_version;
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
    set += ', password_hash = @password_hash, token_version = token_version + 1';
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

module.exports = {
  updateEmail,
  findByEmail, findById, findAuthState, findAll, create, update, remove, countByRole,
  registerFailure, resetFailures, updatePassword, bumpTokenVersion, setEmailVerified,
};
