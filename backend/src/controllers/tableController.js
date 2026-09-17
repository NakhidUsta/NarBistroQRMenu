const tableService = require('../services/tableService');
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
  res.status(201).json(await tableService.createTable(req.body));
});

exports.updateTable = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!validateId(id)) throw new AppError(400, 'Yanlış masa ID-si');
  const validationError = validateTableBody(req.body);
  if (validationError) throw new AppError(400, validationError);
  res.json(await tableService.updateTable(id, req.body));
});

exports.regenerateQr = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!validateId(id)) throw new AppError(400, 'Yanlış masa ID-si');
  res.json(await tableService.regenerateQr(id));
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
  await tableService.deleteTable(id);
  res.status(204).send();
});

exports.callWaiter = asyncHandler(async (req, res) => {
  res.status(201).json(await tableService.callWaiter(req.params.code));
});

exports.requestBill = asyncHandler(async (req, res) => {
  res.status(201).json(await tableService.requestBill(req.params.code));
});
