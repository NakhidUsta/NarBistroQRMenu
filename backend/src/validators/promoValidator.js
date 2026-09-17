const TYPES = ['PERCENT', 'FIXED'];

function validatePromoBody(body) {
  const { code, discount_type, discount_value } = body;
  if (!code || !String(code).trim()) return 'Kod tələb olunur';
  if (!TYPES.includes(discount_type)) return 'discount_type PERCENT və ya FIXED olmalıdır';
  const val = Number(discount_value);
  if (!Number.isFinite(val) || val <= 0) return 'Endirim dəyəri düzgün deyil';
  if (discount_type === 'PERCENT' && val > 100) return 'Faiz endirimi 100-dən böyük ola bilməz';
  return null;
}

function validateId(id) {
  return Number.isInteger(id) && id > 0;
}

module.exports = { validatePromoBody, validateId };
