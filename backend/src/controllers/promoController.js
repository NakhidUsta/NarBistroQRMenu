const promoService = require('../services/promoService');
const { validatePromoBody, validateId } = require('../validators/promoValidator');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');

exports.getAllPromoCodes = asyncHandler(async (req, res) => {
  res.json(await promoService.listPromoCodes());
});

exports.createPromoCode = asyncHandler(async (req, res) => {
  const validationError = validatePromoBody(req.body);
  if (validationError) throw new AppError(400, validationError);
  res.status(201).json(await promoService.createPromoCode(req.body));
});

exports.updatePromoCode = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!validateId(id)) throw new AppError(400, 'Yanlış promo kod ID-si');
  const validationError = validatePromoBody({ ...req.body, code: 'placeholder' });
  if (validationError) throw new AppError(400, validationError);
  res.json(await promoService.updatePromoCode(id, req.body));
});

exports.deletePromoCode = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!validateId(id)) throw new AppError(400, 'Yanlış promo kod ID-si');
  await promoService.deletePromoCode(id);
  res.status(204).send();
});
