const productService = require('../services/productService');
const auditService = require('../services/auditService');
const { validateProductBody, validateId } = require('../validators/productValidator');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');

exports.getAllProducts = asyncHandler(async (req, res) => {
  const category_id = req.query.category_id ? Number(req.query.category_id) : undefined;
  const products = await productService.listProducts({ category_id, includeHidden: !!req.admin });
  res.json(products);
});

exports.getProductById = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!validateId(id)) throw new AppError(400, 'Yanlış məhsul ID-si');
  res.json(await productService.getProduct(id, { isAdmin: !!req.admin }));
});

exports.createProduct = asyncHandler(async (req, res) => {
  const validationError = validateProductBody(req.body);
  if (validationError) throw new AppError(400, validationError);
  const product = await productService.createProduct(req.body);
  await auditService.log(req, 'product.create', 'products', product.id, null, product);
  res.status(201).json(product);
});

exports.updateProduct = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!validateId(id)) throw new AppError(400, 'Yanlış məhsul ID-si');
  const validationError = validateProductBody(req.body);
  if (validationError) throw new AppError(400, validationError);
  const before = await productService.getProduct(id, { isAdmin: true });
  const product = await productService.updateProduct(id, req.body);
  await auditService.log(req, 'product.update', 'products', id, before, product);
  res.json(product);
});

exports.setAvailability = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!validateId(id)) throw new AppError(400, 'Yanlış məhsul ID-si');
  if (typeof req.body.is_available !== 'boolean') throw new AppError(400, 'is_available boolean olmalıdır');
  const before = await productService.getProduct(id, { isAdmin: true });
  const product = await productService.setAvailability(id, req.body.is_available);
  await auditService.log(req, 'product.availability', 'products', id, { is_available: before.is_available }, { is_available: product.is_available });
  res.json(product);
});

exports.setVisibility = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!validateId(id)) throw new AppError(400, 'Yanlış məhsul ID-si');
  if (typeof req.body.is_visible !== 'boolean') throw new AppError(400, 'is_visible boolean olmalıdır');
  const before = await productService.getProduct(id, { isAdmin: true });
  const product = await productService.setVisibility(id, req.body.is_visible);
  await auditService.log(req, 'product.visibility', 'products', id, { is_visible: before.is_visible }, { is_visible: product.is_visible });
  res.json(product);
});

exports.deleteProduct = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!validateId(id)) throw new AppError(400, 'Yanlış məhsul ID-si');
  const before = await productService.getProduct(id, { isAdmin: true });
  await productService.deleteProduct(id);
  await auditService.log(req, 'product.delete', 'products', id, before, null);
  res.status(204).send();
});

exports.adjustStock = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!validateId(id)) throw new AppError(400, 'Yanlış məhsul ID-si');
  const changeQty = Number(req.body.change_qty);
  if (!Number.isInteger(changeQty) || changeQty === 0) throw new AppError(400, 'change_qty sıfırdan fərqli tam ədəd olmalıdır');
  const before = await productService.getProduct(id, { isAdmin: true });
  const product = await productService.adjustStock(id, changeQty);
  await auditService.log(req, 'product.stock', 'products', id, { stock_quantity: before.stock_quantity }, { stock_quantity: product.stock_quantity });
  res.json(product);
});
