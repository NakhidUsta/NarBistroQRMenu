const { sql } = require('../config/db');

async function findProductPrice(transaction, productId) {
  const result = await new sql.Request(transaction)
    .input('id', sql.Int, productId)
    .query('SELECT id, price, is_available, stock_quantity, track_inventory FROM products WHERE id = @id');
  return result.recordset[0] || null;
}

// Atomik azaltma: stok kifayət etmirsə (WHERE şərti tutmur) 0 sətir təsirlənir — sifariş rədd edilir.
async function decrementStockTx(transaction, productId, qty) {
  const result = await new sql.Request(transaction)
    .input('id', sql.Int, productId)
    .input('qty', sql.Int, qty)
    .query(`
      UPDATE products
      SET stock_quantity = stock_quantity - @qty,
          is_available = CASE WHEN stock_quantity - @qty <= 0 THEN 0 ELSE is_available END
      OUTPUT INSERTED.*
      WHERE id = @id AND track_inventory = 1 AND stock_quantity >= @qty
    `);
  return result.recordset[0] || null;
}

async function insertStockMovementTx(transaction, { product_id, change_qty, reason, order_id }) {
  await new sql.Request(transaction)
    .input('product_id', sql.Int, product_id)
    .input('change_qty', sql.Int, change_qty)
    .input('reason', sql.NVarChar(30), reason)
    .input('order_id', sql.Int, order_id || null)
    .query(`
      INSERT INTO stock_movements (product_id, change_qty, reason, order_id)
      VALUES (@product_id, @change_qty, @reason, @order_id)
    `);
}

async function insertOrder(transaction, {
  restaurant_id, table_id, table_session_id, customer_name, phone, note,
  subtotal, discount, vat, service_fee, delivery_fee, currency, total, promo_code_id, promo_code, access_token,
}) {
  const result = await new sql.Request(transaction)
    .input('restaurant_id', sql.Int, restaurant_id)
    .input('table_id', sql.Int, table_id || null)
    .input('table_session_id', sql.Int, table_session_id || null)
    .input('customer_name', sql.NVarChar(120), customer_name)
    .input('phone', sql.NVarChar(30), phone)
    .input('note', sql.NVarChar(300), note || null)
    .input('subtotal', sql.Decimal(10, 2), subtotal)
    .input('discount', sql.Decimal(10, 2), discount || 0)
    .input('vat', sql.Decimal(10, 2), vat || 0)
    .input('service_fee', sql.Decimal(10, 2), service_fee || 0)
    .input('delivery_fee', sql.Decimal(10, 2), delivery_fee || 0)
    .input('currency', sql.NVarChar(3), currency || 'AZN')
    .input('total', sql.Decimal(10, 2), total)
    .input('promo_code_id', sql.Int, promo_code_id || null)
    .input('promo_code', sql.NVarChar(30), promo_code || null)
    .input('access_token', sql.NVarChar(64), access_token)
    .query(`
      INSERT INTO orders (restaurant_id, table_id, table_session_id, customer_name, phone, note, subtotal, discount, vat, service_fee, delivery_fee, currency, total, promo_code_id, promo_code, access_token)
      OUTPUT INSERTED.*
      VALUES (@restaurant_id, @table_id, @table_session_id, @customer_name, @phone, @note, @subtotal, @discount, @vat, @service_fee, @delivery_fee, @currency, @total, @promo_code_id, @promo_code, @access_token)
    `);
  return result.recordset[0];
}

async function insertOrderItem(transaction, { order_id, product_id, quantity, price_at_order }) {
  await new sql.Request(transaction)
    .input('order_id', sql.Int, order_id)
    .input('product_id', sql.Int, product_id)
    .input('quantity', sql.Int, quantity)
    .input('price_at_order', sql.Decimal(10, 2), price_at_order)
    .query(`
      INSERT INTO order_items (order_id, product_id, quantity, price_at_order)
      VALUES (@order_id, @product_id, @quantity, @price_at_order)
    `);
}

async function insertStatusHistory(transaction, { order_id, status, changed_by, note }) {
  await new sql.Request(transaction)
    .input('order_id', sql.Int, order_id)
    .input('status', sql.NVarChar(20), status)
    .input('changed_by', sql.Int, changed_by || null)
    .input('note', sql.NVarChar(300), note || null)
    .query(`
      INSERT INTO order_status_history (order_id, status, changed_by, note)
      VALUES (@order_id, @status, @changed_by, @note)
    `);
}

async function updateStatus(transaction, orderId, status) {
  const result = await new sql.Request(transaction)
    .input('id', sql.Int, orderId)
    .input('status', sql.NVarChar(20), status)
    .query('UPDATE orders SET status = @status OUTPUT INSERTED.* WHERE id = @id');
  return result.recordset[0] || null;
}

async function findById(pool, id) {
  const orderResult = await pool.request()
    .input('id', sql.Int, id)
    .query('SELECT * FROM orders WHERE id = @id');
  const order = orderResult.recordset[0];
  if (!order) return null;

  const itemsResult = await pool.request()
    .input('id', sql.Int, id)
    .query(`
      SELECT oi.id, oi.product_id, p.name, oi.quantity, oi.price_at_order
      FROM order_items oi
      LEFT JOIN products p ON p.id = oi.product_id
      WHERE oi.order_id = @id
    `);

  const historyResult = await pool.request()
    .input('id', sql.Int, id)
    .query('SELECT status, created_at FROM order_status_history WHERE order_id = @id ORDER BY created_at ASC');

  return { ...order, items: itemsResult.recordset, history: historyResult.recordset };
}

async function findAll(pool, { status } = {}) {
  const request = pool.request();
  let query = 'SELECT * FROM orders';
  if (status) {
    query += ' WHERE status = @status';
    request.input('status', sql.NVarChar(20), status);
  }
  query += ' ORDER BY created_at DESC';
  const result = await request.query(query);
  const orders = result.recordset;
  if (!orders.length) return orders;

  // Sifariş siyahısında (admin lövhəsi, mətbəx ekranı) məhsullar və masa adı da lazımdır.
  const ids = orders.map((o) => Number(o.id)).join(',');
  const itemsResult = await pool.request().query(`
    SELECT oi.order_id, oi.product_id, p.name, oi.quantity, oi.price_at_order
    FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id
    WHERE oi.order_id IN (${ids})
  `);
  const tablesResult = await pool.request().query('SELECT id, label FROM restaurant_tables');
  const tableLabels = new Map(tablesResult.recordset.map((t) => [t.id, t.label]));
  return orders.map((o) => ({
    ...o,
    table_label: o.table_id ? tableLabels.get(o.table_id) || null : null,
    items: itemsResult.recordset.filter((i) => i.order_id === o.id),
  }));
}

module.exports = {
  findProductPrice,
  decrementStockTx,
  insertStockMovementTx,
  insertOrder,
  insertOrderItem,
  insertStatusHistory,
  updateStatus,
  findById,
  findAll,
};
