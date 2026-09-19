const { sql, poolPromise } = require('../config/db');

// Eyni məqsəd üçün əvvəlki açıq tokenlər ləğv edilir — hər an yalnız BİR etibarlı link olur
async function invalidateOpen(admin_user_id, purpose) {
  const pool = await poolPromise;
  await pool.request()
    .input('uid', sql.Int, admin_user_id)
    .input('purpose', sql.NVarChar(20), purpose)
    .query('UPDATE email_tokens SET used_at = SYSUTCDATETIME() WHERE admin_user_id = @uid AND purpose = @purpose AND used_at IS NULL');
}

async function create({ admin_user_id, purpose, token_hash, expires_at }) {
  const pool = await poolPromise;
  await pool.request()
    .input('uid', sql.Int, admin_user_id)
    .input('purpose', sql.NVarChar(20), purpose)
    .input('hash', sql.Char(64), token_hash)
    .input('exp', sql.DateTime2, expires_at)
    .query('INSERT INTO email_tokens (admin_user_id, purpose, token_hash, expires_at) VALUES (@uid, @purpose, @hash, @exp)');
}

async function findByHash(token_hash) {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('hash', sql.Char(64), token_hash)
    .query(`
      SELECT t.id, t.admin_user_id, t.purpose, t.expires_at, t.used_at, u.email
      FROM email_tokens t JOIN admin_users u ON u.id = t.admin_user_id
      WHERE t.token_hash = @hash
    `);
  return result.recordset[0] || null;
}

// Atomik: token yalnız bir dəfə "istifadə olunur" (paralel iki sorğudan yalnız biri qalib gəlir)
async function markUsed(id) {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('id', sql.Int, id)
    .query('UPDATE email_tokens SET used_at = SYSUTCDATETIME() WHERE id = @id AND used_at IS NULL');
  return result.rowsAffected[0] > 0;
}

// Sui-istifadəyə qarşı: son `minutes` dəqiqədə bu hesab üçün neçə token yaradılıb
async function countRecent(admin_user_id, purpose, minutes) {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('uid', sql.Int, admin_user_id)
    .input('purpose', sql.NVarChar(20), purpose)
    .input('mins', sql.Int, minutes)
    .query('SELECT COUNT(*) AS n FROM email_tokens WHERE admin_user_id = @uid AND purpose = @purpose AND created_at > DATEADD(MINUTE, -@mins, SYSUTCDATETIME())');
  return result.recordset[0].n;
}

async function purgeOld() {
  const pool = await poolPromise;
  await pool.request().query('DELETE FROM email_tokens WHERE expires_at < DATEADD(DAY, -2, SYSUTCDATETIME())');
}

module.exports = { invalidateOpen, create, findByHash, markUsed, countRecent, purgeOld };
