function validateCategoryBody(body) {
  const { name, slug } = body;
  if (!name || !String(name).trim()) return 'Ad tələb olunur';
  if (!slug || !String(slug).trim()) return 'Slug tələb olunur';
  if (!/^[a-z0-9-]+$/.test(slug)) return 'Slug yalnız kiçik hərf, rəqəm və tire (-) daşıya bilər';
  return null;
}

function validateId(id) {
  return Number.isInteger(id) && id > 0;
}

module.exports = { validateCategoryBody, validateId };
