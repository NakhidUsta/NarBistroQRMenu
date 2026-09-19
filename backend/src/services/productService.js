const productRepository = require('../repositories/productRepository');
const allergenService = require('./allergenService');
const ingredientService = require('./ingredientService');
const AppError = require('../utils/AppError');
const { emitProductUpdated } = require('../sockets/emit');

const DEFAULT_RESTAURANT_ID = 1;

// Qalereya verilibsə: təkrarlar atılır və birinci şəkil əsas şəkil (image_url) olur.
// Allergen ID-ləri kataloqa qarşı yoxlanılır. Verilməyən sahələrə toxunulmur.
async function normalizeRelations(body) {
  const out = { ...body };
  if (Array.isArray(body.images)) {
    const images = [...new Set(body.images.map((u) => u.trim()).filter(Boolean))];
    out.images = images;
    out.image_url = images[0] || null;
  }
  if (Array.isArray(body.allergen_ids)) {
    const ids = [...new Set(body.allergen_ids)];
    const known = await allergenService.existingIds();
    if (ids.some((id) => !known.has(id))) throw new AppError(400, 'Naməlum allergen seçilib');
    out.allergen_ids = ids;
  }
  if (Array.isArray(body.ingredient_ids)) {
    // sıra əhəmiyyətlidir (menyuda göstərilmə ardıcıllığı) — təkrarlar atılır, ilk rast gəlinən qalır
    const ids = [...new Set(body.ingredient_ids)];
    const known = await ingredientService.existingIds();
    if (ids.some((id) => !known.has(id))) throw new AppError(400, 'Naməlum tərkib komponenti seçilib');
    out.ingredient_ids = ids;
  }
  return out;
}

async function listProducts(filters) {
  return productRepository.findAll(filters);
}

async function getProduct(id) {
  const product = await productRepository.findById(id);
  if (!product) throw new AppError(404, 'Məhsul tapılmadı');
  return product;
}

async function createProduct(body) {
  const product = await productRepository.create({ ...(await normalizeRelations(body)), restaurant_id: DEFAULT_RESTAURANT_ID });
  emitProductUpdated(product, 'created');
  return product;
}

async function updateProduct(id, body) {
  const product = await productRepository.update(id, await normalizeRelations(body));
  if (!product) throw new AppError(404, 'Məhsul tapılmadı');
  emitProductUpdated(product, 'updated');
  return product;
}

async function setAvailability(id, isAvailable) {
  const product = await productRepository.setAvailability(id, isAvailable);
  if (!product) throw new AppError(404, 'Məhsul tapılmadı');
  emitProductUpdated(product, 'updated');
  return product;
}

async function deleteProduct(id) {
  const deleted = await productRepository.remove(id);
  if (!deleted) throw new AppError(404, 'Məhsul tapılmadı');
  emitProductUpdated({ id }, 'deleted');
}

async function adjustStock(id, changeQty) {
  const product = await productRepository.adjustStock(id, changeQty);
  if (!product) throw new AppError(404, 'Məhsul tapılmadı');
  emitProductUpdated(product, 'updated');
  return product;
}

module.exports = { listProducts, getProduct, createProduct, updateProduct, setAvailability, deleteProduct, adjustStock };
