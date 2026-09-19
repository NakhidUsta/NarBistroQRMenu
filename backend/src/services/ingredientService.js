const ingredientRepository = require('../repositories/ingredientRepository');
const AppError = require('../utils/AppError');
const { emitIngredientUpdated } = require('../sockets/emit');

// SQL Server unikal indeks pozuntusu: 2601 (unique index), 2627 (unique constraint)
const isDuplicate = (err) => err && (err.number === 2601 || err.number === 2627);

async function list() {
  return ingredientRepository.findAll();
}

async function existingIds() {
  return new Set((await ingredientRepository.findAll()).map((i) => i.id));
}

async function get(id) {
  const ingredient = await ingredientRepository.findById(id);
  if (!ingredient) throw new AppError(404, 'Tərkib komponenti tapılmadı');
  return ingredient;
}

async function create(body) {
  try {
    const ingredient = await ingredientRepository.create(body);
    emitIngredientUpdated(ingredient, 'created');
    return ingredient;
  } catch (err) {
    if (isDuplicate(err)) throw new AppError(409, 'Bu adda komponent artıq var');
    throw err;
  }
}

async function update(id, body) {
  try {
    const ingredient = await ingredientRepository.update(id, body);
    if (!ingredient) throw new AppError(404, 'Tərkib komponenti tapılmadı');
    emitIngredientUpdated(ingredient, 'updated');
    return ingredient;
  } catch (err) {
    if (isDuplicate(err)) throw new AppError(409, 'Bu adda komponent artıq var');
    throw err;
  }
}

// Məhsullarda istifadə olunan komponent silinmir — səssizcə tərkibdən itməsin
async function remove(id) {
  await get(id);
  const used = await ingredientRepository.usageCount(id);
  if (used > 0) throw new AppError(409, `Bu komponent ${used} məhsulda istifadə olunur — əvvəlcə onlardan çıxarın`);
  await ingredientRepository.remove(id);
  emitIngredientUpdated({ id }, 'deleted');
}

module.exports = { list, existingIds, get, create, update, remove };
