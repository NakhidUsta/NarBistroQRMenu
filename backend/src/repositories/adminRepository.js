const { poolPromise } = require('../config/db');

async function getTodayStats() {
  const pool = await poolPromise;
  const result = await pool.request().query(`
    SELECT COUNT(*) AS order_count, ISNULL(SUM(total), 0) AS total_sales
    FROM orders
    WHERE CAST(created_at AS DATE) = CAST(SYSUTCDATETIME() AS DATE)
      AND status != 'CANCELLED'
  `);
  return result.recordset[0];
}

async function getStatusBreakdown() {
  const pool = await poolPromise;
  const result = await pool.request().query(`
    SELECT status, COUNT(*) AS count
    FROM orders
    WHERE CAST(created_at AS DATE) = CAST(SYSUTCDATETIME() AS DATE)
    GROUP BY status
  `);
  return result.recordset;
}

async function getTopProducts() {
  const pool = await poolPromise;
  const result = await pool.request().query(`
    SELECT TOP 5 p.id, p.name, SUM(oi.quantity) AS total_quantity
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    JOIN products p ON p.id = oi.product_id
    WHERE o.created_at >= DATEADD(DAY, -7, SYSUTCDATETIME())
      AND o.status != 'CANCELLED'
    GROUP BY p.id, p.name
    ORDER BY SUM(oi.quantity) DESC
  `);
  return result.recordset;
}

async function getActiveTablesCount() {
  const pool = await poolPromise;
  const result = await pool.request().query(`
    SELECT COUNT(DISTINCT table_id) AS active_tables
    FROM orders
    WHERE table_id IS NOT NULL AND status NOT IN ('COMPLETED', 'CANCELLED')
  `);
  return result.recordset[0].active_tables;
}

module.exports = { getTodayStats, getStatusBreakdown, getTopProducts, getActiveTablesCount };
