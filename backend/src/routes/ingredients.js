const express = require('express');
const router = express.Router();
const ingredientService = require('../services/ingredientService');
const auditService = require('../services/auditService');
const { validateIngredientBody, clean } = require('../validators/ingredientValidator');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { requireAdmin, authorize } = require('../middleware/auth');

const validId = (v) => {
  const id = Number(v);
  if (!Number.isInteger(id) || id <= 0) throw new AppError(400, 'Yanlış ID');
  return id;
};

const canEdit = [requireAdmin, authorize('OWNER', 'MANAGER')];

// Tərkib komponentləri kataloqu — müştəri UI-ı (tərcümə üçün) və admin forması üçün açıq oxunur
router.get('/', asyncHandler(async (req, res) => {
  res.json(await ingredientService.list());
}));

router.post('/', canEdit, asyncHandler(async (req, res) => {
  const error = validateIngredientBody(req.body);
  if (error) throw new AppError(400, error);
  const ingredient = await ingredientService.create(clean(req.body));
  await auditService.log(req, 'ingredient.create', 'ingredients', ingredient.id, null, ingredient);
  res.status(201).json(ingredient);
}));

router.put('/:id', canEdit, asyncHandler(async (req, res) => {
  const id = validId(req.params.id);
  const error = validateIngredientBody(req.body);
  if (error) throw new AppError(400, error);
  const before = await ingredientService.get(id);
  const ingredient = await ingredientService.update(id, clean(req.body));
  await auditService.log(req, 'ingredient.update', 'ingredients', id, before, ingredient);
  res.json(ingredient);
}));

router.delete('/:id', canEdit, asyncHandler(async (req, res) => {
  const id = validId(req.params.id);
  const before = await ingredientService.get(id);
  await ingredientService.remove(id);
  await auditService.log(req, 'ingredient.delete', 'ingredients', id, before, null);
  res.status(204).send();
}));

module.exports = router;
