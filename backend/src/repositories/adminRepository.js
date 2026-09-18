const { sql, poolPromise } = require('../config/db');

const { TZ } = require('../config/tz');
const LOCAL = `DATEADD(HOUR, ${TZ}, o.created_at)`;
const RANGE = `CAST(${LOCAL} AS DATE) BETWEEN @from AND @to`;

async function run(query, { from, to } = {}) {
  const pool = await poolPromise;
  const request = pool.request();
  if (from) request.input('from', sql.Date, from);
  if (to) request.input('to', sql.Date, to);
  const result = await request.query(query);
  return result.recordset;
}

async function getSummary(range) {
  const [row] = await run(`
    SELECT
      SUM(CASE WHEN o.status <> 'CANCELLED' THEN 1 ELSE 0 END) AS order_count,
      ISNULL(SUM(CASE WHEN o.status <> 'CANCELLED' THEN o.total END), 0) AS total_sales,
      ISNULL(AVG(CASE WHEN o.status <> 'CANCELLED' THEN o.total END), 0) AS avg_check,
      SUM(CASE WHEN o.status = 'CANCELLED' THEN 1 ELSE 0 END) AS cancelled_count,
      ISNULL(SUM(CASE WHEN o.status <> 'CANCELLED' THEN o.discount END), 0) AS total_discount
    FROM orders o WHERE ${RANGE}
  `, range);
  return {
    order_count: row.order_count || 0,
    total_sales: row.total_sales,
    avg_check: row.avg_check,
    cancelled_count: row.cancelled_count || 0,
    total_discount: row.total_discount,
  };
}

async function getDailySales(range) {
  return run(`
    SELECT CONVERT(VARCHAR(10), CAST(${LOCAL} AS DATE), 23) AS day,
           COUNT(*) AS orders, ISNULL(SUM(o.total), 0) AS sales
    FROM orders o WHERE ${RANGE} AND o.status <> 'CANCELLED'
    GROUP BY CAST(${LOCAL} AS DATE) ORDER BY CAST(${LOCAL} AS DATE)
  `, range);
}

async function getHourly(range) {
  return run(`
    SELECT DATEPART(HOUR, ${LOCAL}) AS hour, COUNT(*) AS orders
    FROM orders o WHERE ${RANGE} AND o.status <> 'CANCELLED'
    GROUP BY DATEPART(HOUR, ${LOCAL}) ORDER BY hour
  `, range);
}

async function getStatusBreakdown(range) {
  return run(`SELECT o.status, COUNT(*) AS count FROM orders o WHERE ${RANGE} GROUP BY o.status`, range);
}

const PRODUCT_SALES = `
  SELECT p.id, p.name, SUM(oi.quantity) AS total_quantity, SUM(oi.quantity * oi.price_at_order) AS revenue
  FROM order_items oi
  JOIN orders o ON o.id = oi.order_id
  JOIN products p ON p.id = oi.product_id
  WHERE ${RANGE} AND o.status <> 'CANCELLED'
  GROUP BY p.id, p.name
`;

async function getTopProducts(range) {
  return run(`SELECT TOP 5 * FROM (${PRODUCT_SALES}) t ORDER BY total_quantity DESC`, range);
}

async function getLeastProducts(range) {
  return run(`SELECT TOP 5 * FROM (${PRODUCT_SALES}) t ORDER BY total_quantity ASC`, range);
}

async function getCategorySales(range) {
  return run(`
    SELECT ISNULL(c.name, N'—') AS name, SUM(oi.quantity * oi.price_at_order) AS revenue
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    JOIN products p ON p.id = oi.product_id
    LEFT JOIN categories c ON c.id = p.category_id
    WHERE ${RANGE} AND o.status <> 'CANCELLED'
    GROUP BY c.name ORDER BY revenue DESC
  `, range);
}

async function getPromoUsage(range) {
  return run(`
    SELECT TOP 5 pc.code, COUNT(*) AS uses, SUM(pu.discount_amount) AS discount
    FROM promo_usage pu
    JOIN promo_codes pc ON pc.id = pu.promo_code_id
    JOIN orders o ON o.id = pu.order_id
    WHERE ${RANGE}
    GROUP BY pc.code ORDER BY uses DESC
  `, range);
}

async function getRecentOrders() {
  return run(`
    SELECT TOP 8 o.id, o.customer_name, o.total, o.status, o.created_at, t.label AS table_label
    FROM orders o LEFT JOIN restaurant_tables t ON t.id = o.table_id
    ORDER BY o.created_at DESC
  `);
}

async function getActiveTablesCount() {
  const [row] = await run(`
    SELECT COUNT(DISTINCT table_id) AS active_tables FROM orders
    WHERE table_id IS NOT NULL AND status NOT IN ('COMPLETED', 'CANCELLED', 'DELIVERED')
  `);
  return row.active_tables;
}

async function getLowStock() {
  return run(`
    SELECT TOP 5 id, name, stock_quantity FROM products
    WHERE track_inventory = 1 AND stock_quantity IS NOT NULL AND stock_quantity <= 5
    ORDER BY stock_quantity ASC
  `);
}

module.exports = {
  TZ,
  getSummary, getDailySales, getHourly, getStatusBreakdown, getTopProducts, getLeastProducts,
  getCategorySales, getPromoUsage, getRecentOrders, getActiveTablesCount, getLowStock,
};
