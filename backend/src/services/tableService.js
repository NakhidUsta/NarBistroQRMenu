const crypto = require('crypto');
const tableRepository = require('../repositories/tableRepository');
const notificationService = require('./notificationService');
const AppError = require('../utils/AppError');
const { emitTableUpdated } = require('../sockets/emit');

const DEFAULT_RESTAURANT_ID = 1;

// Sabit vaxtlı müqayisə: QR tokeni cavab vaxtı fərqi ilə təxmin edilməsin
function tokenMatches(expected, given) {
  if (typeof expected !== 'string' || typeof given !== 'string') return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(given);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function generateToken() {
  return crypto.randomBytes(16).toString('hex');
}

function slugifyCode(label) {
  const base = String(label)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return `table_${base || crypto.randomBytes(3).toString('hex')}`;
}

async function listTables() {
  return tableRepository.findAll();
}

async function getTable(id) {
  const table = await tableRepository.findById(id);
  if (!table) throw new AppError(404, 'Masa tapılmadı');
  return table;
}

async function createTable(body) {
  const code = `${slugifyCode(body.label)}_${Date.now().toString(36)}`;
  const table = await tableRepository.create({
    restaurant_id: DEFAULT_RESTAURANT_ID,
    label: body.label,
    code,
    capacity: body.capacity,
    qr_token: generateToken(),
  });
  emitTableUpdated(table, 'created');
  return table;
}

async function updateTable(id, body) {
  const table = await tableRepository.update(id, body);
  if (!table) throw new AppError(404, 'Masa tapılmadı');
  emitTableUpdated(table, 'updated');
  return table;
}

async function regenerateQr(id) {
  const table = await tableRepository.rotateQrToken(id, generateToken());
  if (!table) throw new AppError(404, 'Masa tapılmadı');
  emitTableUpdated(table, 'regenerated');
  return table;
}

async function scanTable(code, token) {
  const table = await tableRepository.findByCode(code);
  if (!table || !table.is_active) throw new AppError(404, 'Masa tapılmadı və ya aktiv deyil');
  if (!tokenMatches(table.qr_token, token)) throw new AppError(400, 'QR kod etibarsızdır — masa sahibindən yeni QR istəyin');

  const updated = await tableRepository.registerScan(code);
  emitTableUpdated(updated, 'scanned');
  return updated;
}

async function deleteTable(id) {
  const deleted = await tableRepository.remove(id);
  if (!deleted) throw new AppError(404, 'Masa tapılmadı');
  emitTableUpdated({ id }, 'deleted');
}

// Çağırış/hesab istəyi yalnız masadakı QR-i oxutmuş adama açıqdır: masa kodu (table_001) təxmin edilə bilər, QR tokeni isə yox.
// Yoxsa kənardan istənilən masaya saxta ofisiant çağırışı göndərmək olardı.
async function findTableForRequest(code, token) {
  const table = await tableRepository.findByCode(code);
  if (!table || !table.is_active) throw new AppError(404, 'Masa tapılmadı');
  if (!tokenMatches(table.qr_token, token)) throw new AppError(403, 'QR kod etibarsızdır — masadakı QR kodu yenidən oxudun');
  return table;
}

async function callWaiter(code, token) {
  const table = await findTableForRequest(code, token);
  return notificationService.createOnce({
    type: 'call_waiter',
    title: `${table.label} — Ofisiant çağırılır`,
    entity_type: 'table',
    entity_id: table.id,
  });
}

async function requestBill(code, token) {
  const table = await findTableForRequest(code, token);
  return notificationService.createOnce({
    type: 'request_bill',
    title: `${table.label} — hesab istəyir`,
    entity_type: 'table',
    entity_id: table.id,
  });
}

module.exports = {
  listTables, getTable, createTable, updateTable, regenerateQr, scanTable, deleteTable,
  callWaiter, requestBill,
};
