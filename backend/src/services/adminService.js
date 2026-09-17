const adminRepository = require('../repositories/adminRepository');

async function getDashboard() {
  const [today, statusBreakdown, topProducts, activeTables] = await Promise.all([
    adminRepository.getTodayStats(),
    adminRepository.getStatusBreakdown(),
    adminRepository.getTopProducts(),
    adminRepository.getActiveTablesCount(),
  ]);

  return {
    today_order_count: today.order_count,
    today_sales: today.total_sales,
    status_breakdown: statusBreakdown,
    top_products: topProducts,
    active_tables: activeTables,
  };
}

module.exports = { getDashboard };
