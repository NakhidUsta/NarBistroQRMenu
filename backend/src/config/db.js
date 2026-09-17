const sql = require('mssql');

const config = {
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: {
    encrypt: false, // lokal SQL Server üçün
    trustServerCertificate: true,
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
