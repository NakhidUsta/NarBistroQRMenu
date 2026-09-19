const MAX = 80;

function validateIngredientBody(body) {
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) return 'Ad tələb olunur';
  for (const key of ['name', 'name_en', 'name_ru']) {
    if (body[key] != null && (typeof body[key] !== 'string' || body[key].trim().length > MAX)) return `${key} ən çox ${MAX} simvol olmalıdır`;
  }
  return null;
}

const clean = (body) => ({
  name: body.name.trim(),
  name_en: body.name_en?.trim() || null,
  name_ru: body.name_ru?.trim() || null,
});

module.exports = { validateIngredientBody, clean, MAX };
