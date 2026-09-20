const { sql } = require('../config/db');
const { TZ } = require('../config/tz');

async function findProductPrice(transaction, productId) {
  const result = await new sql.Request(transaction)
    .input('id', sql.Int, productId)
    .query('SELECT id, price, is_available, is_visible, stock_quantity, track_inventory FROM products WHERE id = @id');
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
  subtotal, discount, vat, service_fee, delivery_fee, currency, total, promo_code_id, promo_code, access_token, client_request_id,
  payment_method = 'CASH', payment_status = 'UNPAID',
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
    .input('client_request_id', sql.NVarChar(64), client_request_id || null)
    .input('payment_method', sql.NVarChar(12), payment_method)
    .input('payment_status', sql.NVarChar(12), payment_status)
    .query(`
      INSERT INTO orders (restaurant_id, table_id, table_session_id, customer_name, phone, note, subtotal, discount, vat, service_fee, delivery_fee, currency, total, promo_code_id, promo_code, access_token, client_request_id, payment_method, payment_status)
      OUTPUT INSERTED.*
      VALUES (@restaurant_id, @table_id, @table_session_id, @customer_name, @phone, @note, @subtotal, @discount, @vat, @service_fee, @delivery_fee, @currency, @total, @promo_code_id, @promo_code, @access_token, @client_request_id, @payment_method, @payment_status)
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

// Ödəniş vəziyyətini yeniləyir (yalnız icazə verilən keçidlər: allowedFrom siyahısındakı statuslardan). Sətir dəyişməyibsə null.
async function setPaymentTx(db, orderId, { payment_status, payment_method, paid_at, paid_amount, allowedFrom }) {
  const request = new sql.Request(db)
    .input('id', sql.Int, orderId)
    .input('ps', sql.NVarChar(12), payment_status)
    .input('pm', sql.NVarChar(12), payment_method || null)
    .input('paid_at', sql.DateTime2, paid_at || null)
    .input('paid_amount', sql.Decimal(10, 2), paid_amount == null ? null : paid_amount);
  const from = (allowedFrom || []).map((v, i) => {
    request.input(`f${i}`, sql.NVarChar(12), v);
    return `@f${i}`;
  });
  const result = await request.query(`
    UPDATE orders
    SET payment_status = @ps,
        payment_method = COALESCE(@pm, payment_method),
        paid_at = COALESCE(@paid_at, paid_at),
        paid_amount = COALESCE(@paid_amount, paid_amount)
    OUTPUT INSERTED.*
    WHERE id = @id${from.length ? ` AND payment_status IN (${from.join(', ')})` : ''}
  `);
  return result.recordset[0] || null;
}

// Status/ödəniş vəziyyətini KİLİDLƏ oxuyur (UPDLOCK): keçid qərarı ilə yeniləmə arasında paralel ödəniş/ləğv sifarişi dəyişməsin
async function findStateForUpdate(db, orderId) {
  const result = await new sql.Request(db)
    .input('id', sql.Int, orderId)
    .query('SELECT id, status, payment_method, payment_status FROM orders WITH (UPDLOCK, ROWLOCK) WHERE id = @id');
  return result.recordset[0] || null;
}

// Vaxtı keçmiş, ödənilməmiş onlayn sifarişlər (stok bloklanıb qalmasın deyə ləğv edilir)
async function findExpiredUnpaidOnline(pool, minutes) {
  const result = await pool.request().input('m', sql.Int, minutes).query(`
    SELECT id FROM orders
    WHERE payment_method = N'ONLINE' AND payment_status IN (N'PENDING', N'FAILED') AND status = N'NEW'
      AND created_at < DATEADD(MINUTE, -@m, SYSUTCDATETIME())
  `);
  return result.recordset.map((r) => r.id);
}

async function findItemsTx(db, orderId) {
  const result = await new sql.Request(db).input('id', sql.Int, orderId).query('SELECT product_id, quantity FROM order_items WHERE order_id = @id AND product_id IS NOT NULL');
  return result.recordset;
}

// Stoku geri qaytarır; məhsul stok 0-a düşdüyü üçün avtomatik bağlanmışdısa yenidən açılır
async function restoreStockTx(db, productId, qty) {
  const result = await new sql.Request(db)
    .input('id', sql.Int, productId)
    .input('qty', sql.Int, qty)
    .query(`
      UPDATE products
      SET is_available = CASE WHEN stock_quantity <= 0 THEN 1 ELSE is_available END,
          stock_quantity = stock_quantity + @qty
      OUTPUT INSERTED.*
      WHERE id = @id AND track_inventory = 1
    `);
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

async function findAccessToken(pool, id) {
  const result = await pool.request().input('id', sql.Int, id).query('SELECT access_token FROM orders WHERE id = @id');
  return result.recordset[0]?.access_token || null;
}

async function findIdByClientRequestId(pool, clientRequestId) {
  const result = await pool.request()
    .input('cid', sql.NVarChar(64), clientRequestId)
    .query('SELECT id, phone FROM orders WHERE client_request_id = @cid');
  return result.recordset[0] || null;
}

async function findAll(pool, { status, q, date, limit = 200, before } = {}) {
  const request = pool.request().input('limit', sql.Int, limit);
  const where = [];
  if (status) {
    where.push('o.status = @status');
    request.input('status', sql.NVarChar(20), status);
  }
  if (before) {
    where.push('o.id < @before');
    request.input('before', sql.Int, before);
  }
  if (date) {
    where.push(`CAST(DATEADD(HOUR, ${TZ}, o.created_at) AS DATE) = @date`);
    request.input('date', sql.Date, date);
  }
  if (q) {
    const conds = ['o.customer_name LIKE @q', 'o.phone LIKE @q', 't.label LIKE @q'];
    request.input('q', sql.NVarChar(102), `%${q}%`);
    const id = Number(q.replace(/^#/, ''));
    if (Number.isInteger(id) && id > 0) {
      conds.push('o.id = @qid');
      request.input('qid', sql.Int, id);
    }
    where.push(`(${conds.join(' OR ')})`);
  }
  const result = await request.query(`
    SELECT TOP (@limit) o.*
    FROM orders o LEFT JOIN restaurant_tables t ON t.id = o.table_id
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY o.created_at DESC, o.id DESC
  `);
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
  setPaymentTx,
  findStateForUpdate,
  findExpiredUnpaidOnline,
  findItemsTx,
  restoreStockTx,
  findById,
  findIdByClientRequestId,
  findAccessToken,
  findAll,
};
