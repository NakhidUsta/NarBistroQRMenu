// QA B: MANAGER/WAITER/KITCHEN üçün brauzerdə əl ilə yoxlama məqsədilə müvəqqəti hesablar (bilinən şifrə ilə).
// Eyni ad şablonu (`qa.tmp.rbac.<rol>@example.test`) istifadə olunur ki, `qa/rbac-matrix.js --cleanup` onları da silsin.
const path = require('path');
const backend = path.resolve(__dirname, '..', 'backend');
require(path.join(backend, 'node_modules', 'dotenv')).config({ path: path.join(backend, '.env') });
const sql = require(path.join(backend, 'node_modules', 'mssql'));
const bcrypt = require(path.join(backend, 'node_modules', 'bcryptjs'));

const PASSWORD = 'QaBrowser-9x-Test!';
const ROLES = ['MANAGER', 'WAITER', 'KITCHEN'];

(async () => {
  const pool = await new sql.ConnectionPool({
    server: process.env.DB_SERVER, database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD,
    options: { encrypt: false, trustServerCertificate: true },
  }).connect();
  const hash = await bcrypt.hash(PASSWORD, 10);
  for (const role of ROLES) {
    const email = `qa.tmp.rbac.${role.toLowerCase()}@example.test`;
    await pool.request().input('e', sql.NVarChar, email).query('DELETE FROM admin_users WHERE email = @e');
    await pool.request().input('e', sql.NVarChar, email).input('h', sql.NVarChar, hash).input('r', sql.NVarChar, role)
      .query('INSERT INTO admin_users (restaurant_id, email, password_hash, role) VALUES (1, @e, @h, @r)');
    console.log(`${role}: ${email} / ${PASSWORD}`);
  }
  await pool.close();
})().catch((e) => { console.error(e); process.exit(1); });
