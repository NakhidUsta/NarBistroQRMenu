const { sql, poolPromise } = require('../config/db');

async function get() {
  const pool = await poolPromise;
  const result = await pool.request().query('SELECT smtp_user, smtp_pass_enc, updated_at FROM mail_settings WHERE id = 1');
  return result.recordset[0] || null;
}

async function save({ smtp_user, smtp_pass_enc, updated_by }) {
  const pool = await poolPromise;
  await pool.request()
    .input('user', sql.NVarChar(150), smtp_user)
    .input('pass', sql.NVarChar(600), smtp_pass_enc)
    .input('by', sql.Int, updated_by || null)
    .query(`
      MERGE mail_settings AS t
      USING (SELECT 1 AS id) AS s ON t.id = s.id
      WHEN MATCHED THEN UPDATE SET smtp_user = @user, smtp_pass_enc = @pass, updated_by = @by, updated_at = SYSUTCDATETIME()
      WHEN NOT MATCHED THEN INSERT (id, smtp_user, smtp_pass_enc, updated_by) VALUES (1, @user, @pass, @by);
    `);
}

async function remove() {
  const pool = await poolPromise;
  await pool.request().query('DELETE FROM mail_settings WHERE id = 1');
}

module.exports = { get, save, remove };
