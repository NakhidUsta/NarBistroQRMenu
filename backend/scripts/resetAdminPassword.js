// Şifrəni unudan admin üçün server tərəfində sıfırlama (e-poçt xidməti tələb etmir):
//   npm run reset-password -- admin@qrmenu.local YeniSifre123
// Bütün köhnə sessiyalar etibarsız olur, hesab bloku götürülür.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const bcrypt = require('bcryptjs');
const { poolPromise, sql } = require('../src/config/db');

async function main() {
  const [email, password] = process.argv.slice(2);
  if (!email || !password) throw new Error('İstifadə: npm run reset-password -- <email> <yeni-şifrə>');
  if (password.length < 8) throw new Error('Şifrə ən azı 8 simvol olmalıdır');

  const pool = await poolPromise;
  const result = await pool.request()
    .input('email', sql.NVarChar(150), email)
    .input('hash', sql.NVarChar(sql.MAX), await bcrypt.hash(password, 10))
    .query(`
      UPDATE admin_users
      SET password_hash = @hash, token_version = token_version + 1, failed_attempts = 0, locked_until = NULL
      WHERE email = @email
    `);
  if (result.rowsAffected[0] === 0) throw new Error(`İstifadəçi tapılmadı: ${email}`);
  console.log(`Şifrə yeniləndi: ${email}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
