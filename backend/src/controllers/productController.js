const productService = require('../services/productService');
const { validateProductBody, validateId } = require('../validators/productValidator');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');

exports.getAllProducts = asyncHandler(async (req, res) => {
  const category_id = req.query.category_id ? Number(req.query.category_id) : undefined;
  const includeUnavailable = !!req.admin;
  const products = await productService.listProducts({ category_id, includeUnavailable });
  res.json(products);
});

exports.getProductById = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!validateId(id)) throw new AppError(400, 'Yanlış məhsul ID-si');
  res.json(await productService.getProduct(id));
});

exports.createProduct = asyncHandler(async (req, res) => {
  const validationError = validateProductBody(req.body);
  if (validationError) throw new AppError(400, validationError);
  res.status(201).json(await productService.createProduct(req.body));
});

exports.updateProduct = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!validateId(id)) throw new AppError(400, 'Yanlış məhsul ID-si');
  const validationError = validateProductBody(req.body);
  if (validationError) throw new AppError(400, validationError);
  res.json(await productService.updateProduct(id, req.body));
});

exports.setAvailability = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!validateId(id)) throw new AppError(400, 'Yanlış məhsul ID-si');
  if (typeof req.body.is_available !== 'boolean') throw new AppError(400, 'is_available boolean olmalıdır');
  res.json(await productService.setAvailability(id, req.body.is_available));
});

exports.deleteProduct = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!validateId(id)) throw new AppError(400, 'Yanlış məhsul ID-si');
  await productService.deleteProduct(id);
  res.status(204).send();
});

exports.adjustStock = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!validateId(id)) throw new AppError(400, 'Yanlış məhsul ID-si');
  const changeQty = Number(req.body.change_qty);
  if (!Number.isInteger(changeQty) || changeQty === 0) throw new AppError(400, 'change_qty sıfırdan fərqli tam ədəd olmalıdır');
  res.json(await productService.adjustStock(id, changeQty));
});
