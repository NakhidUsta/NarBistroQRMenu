const { poolPromise } = require('../config/db');

async function findAll() {
  const pool = await poolPromise;
  const result = await pool.request().query('SELECT id, code, name, name_en, name_ru, icon, sort_order FROM allergens ORDER BY sort_order, id');
  return result.recordset;
}

module.exports = { findAll };
