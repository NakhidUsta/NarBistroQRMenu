const { sql, poolPromise } = require('../config/db');
const { COUNTED } = require('./adminRepository');
const { TZ } = require('../config/tz');

const LOCAL = `DATEADD(HOUR, ${TZ}, o.created_at)`;

async function getCustomers({ q } = {}) {
  const pool = await poolPromise;
  const request = pool.request();
  let having = '';
  if (q) {
    request.input('q', sql.NVarChar(102), `%${q}%`);
    having = 'HAVING MAX(o.customer_name) LIKE @q OR o.phone LIKE @q';
  }
  // Müştərilər telefon nömrəsi ilə eyniləşdirilir (hesab/login yoxdur); ən son ad göstərilir.
  const result = await request.query(`
    SELECT TOP 500 o.phone,
           (SELECT TOP 1 x.customer_name FROM orders x WHERE x.phone = o.phone ORDER BY x.created_at DESC) AS name,
           COUNT(*) AS orders_count,
           ISNULL(SUM(CASE WHEN ${COUNTED} THEN o.total END), 0) AS total_spent,
           MAX(o.created_at) AS last_order_at
    FROM orders o
    GROUP BY o.phone
    ${having}
    ORDER BY MAX(o.created_at) DESC
  `);
  return result.recordset;
}

async function getInventoryProducts() {
  const pool = await poolPromise;
  const result = await pool.request().query(`
    SELECT p.id, p.name, p.stock_quantity, p.is_available, c.name AS category
    FROM products p LEFT JOIN categories c ON c.id = p.category_id
    WHERE p.track_inventory = 1
    ORDER BY CASE WHEN p.stock_quantity IS NULL THEN 1 ELSE 0 END, p.stock_quantity ASC, p.name
  `);
  return result.recordset;
}

async function getStockMovements(limit = 60) {
  const pool = await poolPromise;
  const result = await pool.request().input('limit', sql.Int, limit).query(`
    SELECT TOP (@limit) m.id, m.product_id, p.name AS product_name, m.change_qty, m.reason, m.order_id, m.created_at
    FROM stock_movements m LEFT JOIN products p ON p.id = m.product_id
    ORDER BY m.created_at DESC, m.id DESC
  `);
  return result.recordset;
}

async function exportOrders({ from, to }) {
  const pool = await poolPromise;
  const result = await pool.request().input('from', sql.Date, from).input('to', sql.Date, to).query(`
    SELECT o.id, CONVERT(VARCHAR(19), ${LOCAL}, 120) AS created_local, t.label AS table_label,
           o.customer_name, o.phone, o.status, o.subtotal, o.discount, o.promo_code,
           o.service_fee, o.vat, o.delivery_fee, o.total, o.currency
    FROM orders o LEFT JOIN restaurant_tables t ON t.id = o.table_id
    WHERE CAST(${LOCAL} AS DATE) BETWEEN @from AND @to
    ORDER BY o.created_at
  `);
  return result.recordset;
}

async function exportProductSales({ from, to }) {
  const pool = await poolPromise;
  const result = await pool.request().input('from', sql.Date, from).input('to', sql.Date, to).query(`
    SELECT p.id, p.name, ISNULL(c.name, N'') AS category,
           SUM(oi.quantity) AS quantity, SUM(oi.quantity * oi.price_at_order) AS revenue
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    JOIN products p ON p.id = oi.product_id
    LEFT JOIN categories c ON c.id = p.category_id
    WHERE CAST(${LOCAL} AS DATE) BETWEEN @from AND @to AND ${COUNTED}
    GROUP BY p.id, p.name, c.name
    ORDER BY revenue DESC
  `);
  return result.recordset;
}

module.exports = { getCustomers, getInventoryProducts, getStockMovements, exportOrders, exportProductSales };
