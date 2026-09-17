const categoryRepository = require('../repositories/categoryRepository');
const AppError = require('../utils/AppError');
const { emitCategoryUpdated } = require('../sockets/emit');

const DEFAULT_RESTAURANT_ID = 1;

async function listCategories(filters) {
  return categoryRepository.findAll(filters);
}

async function getCategory(id) {
  const category = await categoryRepository.findById(id);
  if (!category) throw new AppError(404, 'Kateqoriya tapılmadı');
  return category;
}

async function createCategory(body) {
  const category = await categoryRepository.create({ ...body, restaurant_id: DEFAULT_RESTAURANT_ID });
  emitCategoryUpdated(category, 'created');
  return category;
}

async function updateCategory(id, body) {
  const category = await categoryRepository.update(id, body);
  if (!category) throw new AppError(404, 'Kateqoriya tapılmadı');
  emitCategoryUpdated(category, 'updated');
  return category;
}

async function deleteCategory(id) {
  const deleted = await categoryRepository.remove(id);
  if (!deleted) throw new AppError(404, 'Kateqoriya tapılmadı');
  emitCategoryUpdated({ id }, 'deleted');
}

module.exports = { listCategories, getCategory, createCategory, updateCategory, deleteCategory };
