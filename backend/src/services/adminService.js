const adminRepository = require('../repositories/adminRepository');
const AppError = require('../utils/AppError');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function localToday() {
  const d = new Date(Date.now() + adminRepository.TZ * 3600 * 1000);
  return d.toISOString().slice(0, 10);
}

function shiftDays(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function resolveRange({ range = 'today', from, to }) {
  const today = localToday();
  if (range === 'today') return { from: today, to: today };
  if (range === 'week') return { from: shiftDays(today, -6), to: today };
  if (range === 'month') return { from: `${today.slice(0, 8)}01`, to: today };
  if (range === 'custom') {
    if (!DATE_RE.test(from || '') || !DATE_RE.test(to || '') || from > to) {
      throw new AppError(400, 'Tarix aralığı düzgün deyil');
    }
    return { from, to };
  }
  throw new AppError(400, 'range today, week, month və ya custom olmalıdır');
}

async function getDashboard(query) {
  const range = resolveRange(query);
  const [summary, daily, hourly, statuses, top, least, categories, promos, recent, activeTables, lowStock] =
    await Promise.all([
      adminRepository.getSummary(range),
      adminRepository.getDailySales(range),
      adminRepository.getHourly(range),
      adminRepository.getStatusBreakdown(range),
      adminRepository.getTopProducts(range),
      adminRepository.getLeastProducts(range),
      adminRepository.getCategorySales(range),
      adminRepository.getPromoUsage(range),
      adminRepository.getRecentOrders(),
      adminRepository.getActiveTablesCount(),
      adminRepository.getLowStock(),
    ]);

  return {
    range,
    summary,
    daily_sales: daily,
    hourly_orders: hourly,
    status_breakdown: statuses,
    top_products: top,
    least_products: least,
    category_sales: categories,
    promo_usage: promos,
    recent_orders: recent,
    active_tables: activeTables,
    low_stock: lowStock,
  };
}

module.exports = { getDashboard };
