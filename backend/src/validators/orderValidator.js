const PHONE_RE = /^[+\d][\d\s\-()]{6,}$/;
const VALID_STATUSES = ['NEW', 'CONFIRMED', 'PREPARING', 'READY', 'DELIVERED', 'COMPLETED', 'CANCELLED'];

function validateCreateOrderBody(body) {
  const { customer_name, phone, items } = body;
  if (!customer_name || !String(customer_name).trim()) return 'Müştəri adı tələb olunur';
  if (!phone || !PHONE_RE.test(String(phone).trim())) return 'Düzgün telefon nömrəsi tələb olunur';
  if (!Array.isArray(items) || items.length === 0) return 'Sifarişdə ən azı bir məhsul olmalıdır';
  for (const item of items) {
    const qty = Number(item.quantity);
    if (!Number.isInteger(item.product_id) || !Number.isInteger(qty) || qty <= 0) {
      return 'Hər sifariş elementi düzgün product_id və quantity daşımalıdır';
    }
  }
  return null;
}

function validateStatus(status) {
  return VALID_STATUSES.includes(status);
}

function validateId(id) {
  return Number.isInteger(id) && id > 0;
}

module.exports = { validateCreateOrderBody, validateStatus, validateId, VALID_STATUSES };
