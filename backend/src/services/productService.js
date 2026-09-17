const productRepository = require('../repositories/productRepository');
const AppError = require('../utils/AppError');
const { emitProductUpdated } = require('../sockets/emit');

const DEFAULT_RESTAURANT_ID = 1;

async function listProducts(filters) {
  return productRepository.findAll(filters);
}

async function getProduct(id) {
  const product = await productRepository.findById(id);
  if (!product) throw new AppError(404, 'Məhsul tapılmadı');
  return product;
}

async function createProduct(body) {
  const product = await productRepository.create({ ...body, restaurant_id: DEFAULT_RESTAURANT_ID });
  emitProductUpdated(product, 'created');
  return product;
}

async function updateProduct(id, body) {
  const product = await productRepository.update(id, body);
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
