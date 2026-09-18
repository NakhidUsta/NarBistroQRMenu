const categoryService = require('../services/categoryService');
const auditService = require('../services/auditService');
const { validateCategoryBody, validateId } = require('../validators/categoryValidator');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');

exports.getAllCategories = asyncHandler(async (req, res) => {
  const includeInactive = req.query.includeInactive === 'true' && !!req.admin;
  const categories = await categoryService.listCategories({ includeInactive });
  res.json(categories);
});

exports.getCategoryById = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!validateId(id)) throw new AppError(400, 'Yanlış kateqoriya ID-si');
  res.json(await categoryService.getCategory(id));
});

exports.createCategory = asyncHandler(async (req, res) => {
  const validationError = validateCategoryBody(req.body);
  if (validationError) throw new AppError(400, validationError);
  const category = await categoryService.createCategory(req.body);
  await auditService.log(req, 'category.create', 'categories', category.id, null, category);
  res.status(201).json(category);
});

exports.updateCategory = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!validateId(id)) throw new AppError(400, 'Yanlış kateqoriya ID-si');
  const validationError = validateCategoryBody(req.body);
  if (validationError) throw new AppError(400, validationError);
  const before = await categoryService.getCategory(id);
  const category = await categoryService.updateCategory(id, req.body);
  await auditService.log(req, 'category.update', 'categories', id, before, category);
  res.json(category);
});

exports.deleteCategory = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!validateId(id)) throw new AppError(400, 'Yanlış kateqoriya ID-si');
  const before = await categoryService.getCategory(id);
  await categoryService.deleteCategory(id);
  await auditService.log(req, 'category.delete', 'categories', id, before, null);
  res.status(204).send();
});
