function validateProductBody(body) {
  const { name, price, category_id } = body;
  if (!name || !String(name).trim()) return 'Ad tələb olunur';
  const priceNum = Number(price);
  if (!Number.isFinite(priceNum) || priceNum < 0) return 'Qiymət düzgün deyil';
  if (!Number.isInteger(Number(category_id))) return 'Kateqoriya tələb olunur';
  return null;
}

function validateId(id) {
  return Number.isInteger(id) && id > 0;
}

module.exports = { validateProductBody, validateId };
