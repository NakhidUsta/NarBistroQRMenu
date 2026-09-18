const insightRepository = require('../repositories/insightRepository');
const AppError = require('../utils/AppError');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function requireRange({ from, to }) {
  if (!DATE_RE.test(from || '') || !DATE_RE.test(to || '') || from > to) throw new AppError(400, 'Tarix aralığı düzgün deyil (from/to, YYYY-MM-DD)');
  return { from, to };
}

// CSV: dəyərlər dırnaqlanır; formula kimi başlayan mətn (=, @, +cmd, -cmd) Excel inyeksiyasına qarşı ' ilə neytrallaşdırılır.
// "+994501112233" kimi ədədi görünüşlü telefon/rəqəmlər toxunulmaz qalır.
function csvCell(value) {
  if (value == null) return '';
  let s = value instanceof Date ? value.toISOString() : String(value);
  const dangerous = /^[=@\t\r]/.test(s) || (/^[+-]/.test(s) && !/^[+-][\d\s().-]+$/.test(s));
  if (typeof value === 'string' && dangerous) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

function toCsv(columns, rows) {
  const head = columns.map(([, label]) => csvCell(label)).join(',');
  const body = rows.map((r) => columns.map(([key]) => csvCell(r[key])).join(','));
  return `﻿${[head, ...body].join('\r\n')}\r\n`; // BOM — Excel Azərbaycan hərflərini düzgün açsın
}

const ORDER_COLUMNS = [
  ['id', '№'], ['created_local', 'Tarix'], ['table_label', 'Masa'], ['customer_name', 'Müştəri'], ['phone', 'Telefon'],
  ['status', 'Status'], ['subtotal', 'Ara cəmi'], ['discount', 'Endirim'], ['promo_code', 'Promo'],
  ['service_fee', 'Servis'], ['vat', 'ƏDV'], ['delivery_fee', 'Çatdırılma'], ['total', 'Cəmi'], ['currency', 'Valyuta'],
];
const PRODUCT_COLUMNS = [['id', 'ID'], ['name', 'Məhsul'], ['category', 'Kateqoriya'], ['quantity', 'Miqdar'], ['revenue', 'Gəlir']];

async function ordersCsv(query) {
  return toCsv(ORDER_COLUMNS, await insightRepository.exportOrders(requireRange(query)));
}

async function productsCsv(query) {
  return toCsv(PRODUCT_COLUMNS, await insightRepository.exportProductSales(requireRange(query)));
}

module.exports = {
  customers: (q) => insightRepository.getCustomers({ q }),
  inventory: async () => ({
    products: await insightRepository.getInventoryProducts(),
    movements: await insightRepository.getStockMovements(),
  }),
  ordersCsv,
  productsCsv,
  csvCell,
  toCsv,
};
