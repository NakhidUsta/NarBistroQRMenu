const tableService = require('../services/tableService');
const auditService = require('../services/auditService');
const { validateTableBody, validateId } = require('../validators/tableValidator');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');

exports.getAllTables = asyncHandler(async (req, res) => {
  res.json(await tableService.listTables());
});

exports.getTableById = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!validateId(id)) throw new AppError(400, 'Yanlış masa ID-si');
  res.json(await tableService.getTable(id));
});

exports.createTable = asyncHandler(async (req, res) => {
  const validationError = validateTableBody(req.body);
  if (validationError) throw new AppError(400, validationError);
  const table = await tableService.createTable(req.body);
  await auditService.log(req, 'table.create', 'restaurant_tables', table.id, null, { label: table.label, code: table.code });
  res.status(201).json(table);
});

exports.updateTable = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!validateId(id)) throw new AppError(400, 'Yanlış masa ID-si');
  const validationError = validateTableBody(req.body);
  if (validationError) throw new AppError(400, validationError);
  const before = await tableService.getTable(id);
  const table = await tableService.updateTable(id, req.body);
  await auditService.log(req, 'table.update', 'restaurant_tables', id, { label: before.label, is_active: before.is_active }, { label: table.label, is_active: table.is_active });
  res.json(table);
});

exports.regenerateQr = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!validateId(id)) throw new AppError(400, 'Yanlış masa ID-si');
  const table = await tableService.regenerateQr(id);
  await auditService.log(req, 'table.qr_regenerate', 'restaurant_tables', id, null, { label: table.label });
  res.json(table);
});

exports.scanTable = asyncHandler(async (req, res) => {
  const { code } = req.params;
  const { token } = req.body;
  if (!token) throw new AppError(400, 'QR token tələb olunur');
  res.json(await tableService.scanTable(code, token));
});

exports.deleteTable = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!validateId(id)) throw new AppError(400, 'Yanlış masa ID-si');
  const before = await tableService.getTable(id);
  await tableService.deleteTable(id);
  await auditService.log(req, 'table.delete', 'restaurant_tables', id, { label: before.label }, null);
  res.status(204).send();
});

exports.callWaiter = asyncHandler(async (req, res) => {
  res.status(201).json(await tableService.callWaiter(req.params.code, req.body?.token));
});

exports.requestBill = asyncHandler(async (req, res) => {
  res.status(201).json(await tableService.requestBill(req.params.code, req.body?.token));
});
