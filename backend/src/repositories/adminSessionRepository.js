const { sql, poolPromise } = require('../config/db');

async function createSession({ admin_user_id, user_agent, ip, expires_at }) {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('uid', sql.Int, admin_user_id)
    .input('ua', sql.NVarChar(300), user_agent || null)
    .input('ip', sql.NVarChar(64), ip || null)
    .input('exp', sql.DateTime2, expires_at)
    .query(`
      INSERT INTO admin_sessions (admin_user_id, user_agent, ip, expires_at)
      OUTPUT INSERTED.*
      VALUES (@uid, @ua, @ip, @exp)
    `);
  return result.recordset[0];
}

async function insertToken({ session_id, token_hash, expires_at }) {
  const pool = await poolPromise;
  await pool.request()
    .input('sid', sql.Int, session_id)
    .input('hash', sql.Char(64), token_hash)
    .input('exp', sql.DateTime2, expires_at)
    .query('INSERT INTO refresh_tokens (session_id, token_hash, expires_at) VALUES (@sid, @hash, @exp)');
}

// Token + sessiya vəziyyəti birlikdə (rotasiya qərarı üçün)
async function findTokenByHash(token_hash) {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('hash', sql.Char(64), token_hash)
    .query(`
      SELECT t.id, t.session_id, t.expires_at, t.used_at,
             s.admin_user_id, s.expires_at AS session_expires_at, s.revoked_at AS session_revoked_at
      FROM refresh_tokens t
      JOIN admin_sessions s ON s.id = t.session_id
      WHERE t.token_hash = @hash
    `);
  return result.recordset[0] || null;
}

// Atomik: yalnız hələ istifadə olunmamış token "istifadə olundu" işarələnir; yarış vəziyyətində yalnız biri qalib gəlir
async function markTokenUsed(id) {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('id', sql.Int, id)
    .query('UPDATE refresh_tokens SET used_at = SYSUTCDATETIME() WHERE id = @id AND used_at IS NULL');
  return result.rowsAffected[0] > 0;
}

async function touchSession(id, { user_agent, ip }) {
  const pool = await poolPromise;
  await pool.request()
    .input('id', sql.Int, id)
    .input('ua', sql.NVarChar(300), user_agent || null)
    .input('ip', sql.NVarChar(64), ip || null)
    .query('UPDATE admin_sessions SET last_used_at = SYSUTCDATETIME(), user_agent = COALESCE(@ua, user_agent), ip = COALESCE(@ip, ip) WHERE id = @id');
}

async function findSession(id) {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('id', sql.Int, id)
    .query('SELECT id, admin_user_id, expires_at, revoked_at FROM admin_sessions WHERE id = @id');
  return result.recordset[0] || null;
}

async function revokeSession(id) {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('id', sql.Int, id)
    .query('UPDATE admin_sessions SET revoked_at = SYSUTCDATETIME() WHERE id = @id AND revoked_at IS NULL');
  return result.rowsAffected[0] > 0;
}

async function revokeAllForUser(admin_user_id, exceptSessionId) {
  const pool = await poolPromise;
  await pool.request()
    .input('uid', sql.Int, admin_user_id)
    .input('except', sql.Int, exceptSessionId || null)
    .query('UPDATE admin_sessions SET revoked_at = SYSUTCDATETIME() WHERE admin_user_id = @uid AND revoked_at IS NULL AND (@except IS NULL OR id <> @except)');
}

async function listActive(admin_user_id) {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('uid', sql.Int, admin_user_id)
    .query(`
      SELECT id, user_agent, ip, created_at, last_used_at, expires_at
      FROM admin_sessions
      WHERE admin_user_id = @uid AND revoked_at IS NULL AND expires_at > SYSUTCDATETIME()
      ORDER BY last_used_at DESC
    `);
  return result.recordset;
}

// Köhnə/bitmiş qeydlərin təmizlənməsi (istifadə olunmuş token-lər 1 gün, bitmiş/ləğv edilmiş sessiyalar 30 gün saxlanılır)
async function purgeOld() {
  const pool = await poolPromise;
  await pool.request().query(`
    DELETE FROM refresh_tokens WHERE (used_at IS NOT NULL AND used_at < DATEADD(DAY, -1, SYSUTCDATETIME())) OR expires_at < DATEADD(DAY, -1, SYSUTCDATETIME());
    DELETE FROM admin_sessions WHERE (revoked_at IS NOT NULL AND revoked_at < DATEADD(DAY, -30, SYSUTCDATETIME())) OR expires_at < DATEADD(DAY, -30, SYSUTCDATETIME());
  `);
}

module.exports = {
  createSession, insertToken, findTokenByHash, markTokenUsed, touchSession, findSession,
  revokeSession, revokeAllForUser, listActive, purgeOld,
};
