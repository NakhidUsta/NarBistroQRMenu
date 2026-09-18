const { sql, poolPromise } = require('../config/db');

async function create({ restaurant_id, order_id, customer_name, rating, comment }) {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('restaurant_id', sql.Int, restaurant_id)
    .input('order_id', sql.Int, order_id)
    .input('customer_name', sql.NVarChar(120), customer_name)
    .input('rating', sql.Int, rating)
    .input('comment', sql.NVarChar(1000), comment || null)
    .query(`
      INSERT INTO reviews (restaurant_id, order_id, customer_name, rating, comment)
      OUTPUT INSERTED.id, INSERTED.rating, INSERTED.comment, INSERTED.is_approved, INSERTED.created_at
      VALUES (@restaurant_id, @order_id, @customer_name, @rating, @comment)
    `);
  return result.recordset[0];
}

async function findByOrder(orderId) {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('order_id', sql.Int, orderId)
    .query('SELECT id, rating, comment, is_approved FROM reviews WHERE order_id = @order_id');
  return result.recordset[0] || null;
}

async function findPublic(limit = 10) {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('limit', sql.Int, limit)
    .query(`
      SELECT TOP (@limit) id, customer_name, rating, comment, created_at
      FROM reviews WHERE is_approved = 1 ORDER BY created_at DESC
    `);
  return result.recordset;
}

async function summary() {
  const pool = await poolPromise;
  const result = await pool.request().query(`
    SELECT COUNT(*) AS count, ISNULL(AVG(CAST(rating AS FLOAT)), 0) AS average
    FROM reviews WHERE is_approved = 1
  `);
  return result.recordset[0];
}

async function findAll() {
  const pool = await poolPromise;
  const result = await pool.request().query(`
    SELECT id, order_id, customer_name, rating, comment, is_approved, created_at
    FROM reviews ORDER BY created_at DESC
  `);
  return result.recordset;
}

async function setApproved(id, isApproved) {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('id', sql.Int, id)
    .input('is_approved', sql.Bit, isApproved ? 1 : 0)
    .query('UPDATE reviews SET is_approved = @is_approved OUTPUT INSERTED.* WHERE id = @id');
  return result.recordset[0] || null;
}

async function remove(id) {
  const pool = await poolPromise;
  const result = await pool.request().input('id', sql.Int, id).query('DELETE FROM reviews WHERE id = @id');
  return result.rowsAffected[0] > 0;
}

module.exports = { create, findByOrder, findPublic, summary, findAll, setApproved, remove };
