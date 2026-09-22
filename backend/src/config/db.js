const sql = require('mssql');

// QA K (yük testi) tapıntısı: bağlantı hovuzunun ölçüsü təyin edilmirdi → mssql/tarn defolt max 10 bağlantı istifadə edirdi.
// Hər sifariş yaradılması bir tranzaksiya ərzində (BEGIN…COMMIT) bir bağlantını tutur; 25+ paralel sifariş 10-luq hovuzu
// tükədirdi, növbədəki sorğular 30 saniyə gözləyib "operation timed out" ilə 500 qaytarırdı (25/25, 50/50 uğursuz oldu).
// Restoran həqiqi rejimdə eyni anda bir neçə masa sifariş verə bilər — bu, sadə həndəvər trafikdə belə baş verə bilərdi.
const config = {
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: {
    encrypt: false, // lokal SQL Server üçün
    trustServerCertificate: true,
  },
  pool: {
    max: Number(process.env.DB_POOL_MAX) || 50,
    min: Number(process.env.DB_POOL_MIN) || 2,
    idleTimeoutMillis: 30000,
    acquireTimeoutMillis: 15000, // 30san yox — bağlantı 15san-də tapılmasa tez uğursuz olur, sorğu asılı qalmır
  },
};

const poolPromise = new sql.ConnectionPool(config)
  .connect()
  .then((pool) => {
    console.log('SQL Server-ə qoşuldu (qr_menu)');
    return pool;
  })
  .catch((err) => {
    console.error('SQL Server bağlantı xətası:', err.message);
    throw err;
  });

// Node, heç bir çağırışçı `await poolPromise` etmədən bu promise rədd olunarsa
// prosesi "unhandled rejection" kimi çökdürür (məs. server ayağa qalxan kimi, hələ
// heç bir sorğu gəlməmiş). Bu boş catch yalnız Node-u sakitləşdirmək üçündür —
// əsl xəta yenə də hər `await poolPromise` edən çağırışçıya ötürülür.
poolPromise.catch(() => {});

module.exports = { sql, poolPromise };
