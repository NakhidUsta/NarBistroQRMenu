const { sql, poolPromise } = require('../config/db');

async function findAll() {
  const pool = await poolPromise;
  const result = await pool.request().query('SELECT * FROM promo_codes ORDER BY created_at DESC');
  return result.recordset;
}

async function findByCode(code) {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('code', sql.NVarChar(30), code)
    .query('SELECT * FROM promo_codes WHERE code = @code');
  return result.recordset[0] || null;
}

async function findByCodeTx(transaction, code) {
  const result = await new sql.Request(transaction)
    .input('code', sql.NVarChar(30), code)
    .query('SELECT * FROM promo_codes WHERE code = @code');
  return result.recordset[0] || null;
}

async function create({ restaurant_id, code, discount_type, discount_value, min_order_amount, starts_at, ends_at, usage_limit, is_active }) {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('restaurant_id', sql.Int, restaurant_id)
    .input('code', sql.NVarChar(30), code.toUpperCase())
    .input('discount_type', sql.NVarChar(10), discount_type)
    .input('discount_value', sql.Decimal(10, 2), discount_value)
    .input('min_order_amount', sql.Decimal(10, 2), min_order_amount || 0)
    .input('starts_at', sql.DateTime2, starts_at || null)
    .input('ends_at', sql.DateTime2, ends_at || null)
    .input('usage_limit', sql.Int, usage_limit || null)
    .input('is_active', sql.Bit, is_active === false ? 0 : 1)
    .query(`
      INSERT INTO promo_codes (restaurant_id, code, discount_type, discount_value, min_order_amount, starts_at, ends_at, usage_limit, is_active)
      OUTPUT INSERTED.*
      VALUES (@restaurant_id, @code, @discount_type, @discount_value, @min_order_amount, @starts_at, @ends_at, @usage_limit, @is_active)
    `);
  return result.recordset[0];
}

async function update(id, { discount_type, discount_value, min_order_amount, starts_at, ends_at, usage_limit, is_active }) {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('id', sql.Int, id)
    .input('discount_type', sql.NVarChar(10), discount_type)
    .input('discount_value', sql.Decimal(10, 2), discount_value)
    .input('min_order_amount', sql.Decimal(10, 2), min_order_amount || 0)
    .input('starts_at', sql.DateTime2, starts_at || null)
    .input('ends_at', sql.DateTime2, ends_at || null)
    .input('usage_limit', sql.Int, usage_limit || null)
    .input('is_active', sql.Bit, is_active === false ? 0 : 1)
    .query(`
      UPDATE promo_codes
      SET discount_type = @discount_type, discount_value = @discount_value, min_order_amount = @min_order_amount,
          starts_at = @starts_at, ends_at = @ends_at, usage_limit = @usage_limit, is_active = @is_active
      OUTPUT INSERTED.*
      WHERE id = @id
    `);
  return result.recordset[0] || null;
}

async function remove(id) {
  const pool = await poolPromise;
  const result = await pool.request().input('id', sql.Int, id).query('DELETE FROM promo_codes WHERE id = @id');
  return result.rowsAffected[0] > 0;
}

async function incrementUsageTx(transaction, id) {
  await new sql.Request(transaction)
    .input('id', sql.Int, id)
    .query('UPDATE promo_codes SET usage_count = usage_count + 1 WHERE id = @id');
}

async function insertUsageTx(transaction, { promo_code_id, order_id, discount_amount }) {
  await new sql.Request(transaction)
    .input('promo_code_id', sql.Int, promo_code_id)
    .input('order_id', sql.Int, order_id)
    .input('discount_amount', sql.Decimal(10, 2), discount_amount)
    .query(`
      INSERT INTO promo_usage (promo_code_id, order_id, discount_amount)
      VALUES (@promo_code_id, @order_id, @discount_amount)
    `);
}

module.exports = { findAll, findByCode, findByCodeTx, create, update, remove, incrementUsageTx, insertUsageTx };
