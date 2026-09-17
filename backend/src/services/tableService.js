const crypto = require('crypto');
const tableRepository = require('../repositories/tableRepository');
const notificationService = require('./notificationService');
const AppError = require('../utils/AppError');
const { emitTableUpdated } = require('../sockets/emit');

const DEFAULT_RESTAURANT_ID = 1;

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
  if (table.qr_token !== token) throw new AppError(400, 'QR kod etibarsızdır — masa sahibindən yeni QR istəyin');

  const updated = await tableRepository.registerScan(code);
  emitTableUpdated(updated, 'scanned');
  return updated;
}

async function deleteTable(id) {
  const deleted = await tableRepository.remove(id);
  if (!deleted) throw new AppError(404, 'Masa tapılmadı');
  emitTableUpdated({ id }, 'deleted');
}

async function callWaiter(code) {
  const table = await tableRepository.findByCode(code);
  if (!table) throw new AppError(404, 'Masa tapılmadı');
  return notificationService.create({
    type: 'call_waiter',
    title: `${table.label} — Ofisiant çağırılır`,
    entity_type: 'table',
    entity_id: table.id,
  });
}

async function requestBill(code) {
  const table = await tableRepository.findByCode(code);
  if (!table) throw new AppError(404, 'Masa tapılmadı');
  return notificationService.create({
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
