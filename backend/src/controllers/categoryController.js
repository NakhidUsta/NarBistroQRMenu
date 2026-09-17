const categoryService = require('../services/categoryService');
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
  res.status(201).json(await categoryService.createCategory(req.body));
});

exports.updateCategory = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!validateId(id)) throw new AppError(400, 'Yanlış kateqoriya ID-si');
  const validationError = validateCategoryBody(req.body);
  if (validationError) throw new AppError(400, validationError);
  res.json(await categoryService.updateCategory(id, req.body));
});

exports.deleteCategory = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!validateId(id)) throw new AppError(400, 'Yanlış kateqoriya ID-si');
  await categoryService.deleteCategory(id);
  res.status(204).send();
});
