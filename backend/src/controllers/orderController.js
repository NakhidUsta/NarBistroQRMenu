const orderService = require('../services/orderService');
const { validateCreateOrderBody, validateStatus, validateId, VALID_STATUSES } = require('../validators/orderValidator');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');

exports.createOrder = asyncHandler(async (req, res) => {
  const validationError = validateCreateOrderBody(req.body);
  if (validationError) throw new AppError(400, validationError);
  res.status(201).json(await orderService.createOrder(req.body));
});

exports.getOrderById = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!validateId(id)) throw new AppError(400, 'Yanlış sifariş ID-si');
  res.json(await orderService.getOrder(id, { isAdmin: !!req.admin, token: req.query.token }));
});

exports.getAllOrders = asyncHandler(async (req, res) => {
  res.json(await orderService.listOrders({ status: req.query.status }));
});

exports.updateOrderStatus = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const { status, note } = req.body;
  if (!validateId(id)) throw new AppError(400, 'Yanlış sifariş ID-si');
  if (!validateStatus(status)) throw new AppError(400, `status bunlardan biri olmalıdır: ${VALID_STATUSES.join(', ')}`);
  res.json(await orderService.updateStatus(id, status, req.admin?.id, note));
});
