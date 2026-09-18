const orderService = require('../services/orderService');
const auditService = require('../services/auditService');
const { validateCreateOrderBody, validateStatus, validateId, VALID_STATUSES } = require('../validators/orderValidator');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');

exports.createOrder = asyncHandler(async (req, res) => {
  const validationError = validateCreateOrderBody(req.body);
  if (validationError) throw new AppError(400, validationError);
  res.status(201).json(await orderService.createOrder(req.body));
});

exports.quoteOrder = asyncHandler(async (req, res) => {
  const { items } = req.body;
  if (!Array.isArray(items) || items.length === 0) throw new AppError(400, 'Səbət boşdur');
  for (const item of items) {
    if (!Number.isInteger(item.product_id) || !Number.isInteger(Number(item.quantity)) || Number(item.quantity) <= 0) {
      throw new AppError(400, 'Hər element düzgün product_id və quantity daşımalıdır');
    }
  }
  res.json(await orderService.quote(req.body));
});

exports.getOrderById =asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!validateId(id)) throw new AppError(400, 'Yanlış sifariş ID-si');
  res.json(await orderService.getOrder(id, { isAdmin: !!req.admin, token: req.query.token }));
});

exports.getAllOrders = asyncHandler(async (req, res) => {
  const { status, q, date } = req.query;
  if (status && !validateStatus(status)) throw new AppError(400, 'Yanlış status filtri');
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new AppError(400, 'Tarix YYYY-MM-DD formatında olmalıdır');
  const search = q ? String(q).trim().slice(0, 100) : undefined;
  res.json(await orderService.listOrders({ status, date, q: search || undefined }));
});

exports.updateOrderStatus = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const { status, note } = req.body;
  if (!validateId(id)) throw new AppError(400, 'Yanlış sifariş ID-si');
  if (!validateStatus(status)) throw new AppError(400, `status bunlardan biri olmalıdır: ${VALID_STATUSES.join(', ')}`);
  const before = await orderService.getOrder(id, { isAdmin: true });
  const order = await orderService.updateStatus(id, status, req.admin?.id, note);
  await auditService.log(req, 'order.status', 'orders', id, { status: before.status }, { status: order.status });
  res.json(order);
});
