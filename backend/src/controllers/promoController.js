const promoService = require('../services/promoService');
const auditService = require('../services/auditService');
const { validatePromoBody, validateId } = require('../validators/promoValidator');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');

exports.getAllPromoCodes = asyncHandler(async (req, res) => {
  res.json(await promoService.listPromoCodes());
});

exports.createPromoCode = asyncHandler(async (req, res) => {
  const validationError = validatePromoBody(req.body);
  if (validationError) throw new AppError(400, validationError);
  const promo = await promoService.createPromoCode(req.body);
  await auditService.log(req, 'promo.create', 'promo_codes', promo.id, null, promo);
  res.status(201).json(promo);
});

exports.updatePromoCode = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!validateId(id)) throw new AppError(400, 'Yanlış promo kod ID-si');
  const validationError = validatePromoBody({ ...req.body, code: 'placeholder' });
  if (validationError) throw new AppError(400, validationError);
  const promo = await promoService.updatePromoCode(id, req.body);
  await auditService.log(req, 'promo.update', 'promo_codes', id, null, promo);
  res.json(promo);
});

exports.deletePromoCode = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!validateId(id)) throw new AppError(400, 'Yanlış promo kod ID-si');
  await promoService.deletePromoCode(id);
  await auditService.log(req, 'promo.delete', 'promo_codes', id, null, null);
  res.status(204).send();
});
