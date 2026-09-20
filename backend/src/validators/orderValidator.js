const PHONE_RE = /^[+\d][\d\s\-()]{6,}$/;
// Idempotency açarı təxmin edilə bilməməlidir (minimum 16 simvol) — qısa/ardıcıl ID-lər başqasının sifarişini "təkrar" kimi çıxara bilməsin
const CLIENT_REQUEST_ID_RE = /^[A-Za-z0-9_-]{16,64}$/;
const PAYMENT_METHODS = ['CASH', 'CARD_POS', 'ONLINE'];
const VALID_STATUSES = ['NEW', 'CONFIRMED', 'PREPARING', 'READY', 'DELIVERED', 'COMPLETED', 'CANCELLED'];

// Sütun uzunluqları (orders cədvəli) ilə üst-üstə düşür — həddi aşan giriş DB-də 500 yox, 400 verir
const MAX_NAME = 120;
const MAX_PHONE = 30;
const MAX_NOTE = 300;
const MAX_ITEMS = 50; // bir sifarişdə fərqli sətir sayı
const MAX_QUANTITY = 99; // bir məhsuldan maksimum ədəd
const MAX_ID = 2147483647; // SQL INT

// Səbət sətirlərinin sayı, ID və miqdar hədləri (sifariş və qiymət hesablaması üçün ortaq)
function validateItems(items) {
  if (!Array.isArray(items) || items.length === 0) return 'Sifarişdə ən azı bir məhsul olmalıdır';
  if (items.length > MAX_ITEMS) return `Sifarişdə ən çox ${MAX_ITEMS} müxtəlif məhsul ola bilər`;
  for (const item of items) {
    const qty = Number(item?.quantity);
    if (!Number.isInteger(item?.product_id) || item.product_id <= 0 || item.product_id > MAX_ID || !Number.isInteger(qty) || qty <= 0) {
      return 'Hər sifariş elementi düzgün product_id və quantity daşımalıdır';
    }
    if (qty > MAX_QUANTITY) return `Bir məhsuldan ən çox ${MAX_QUANTITY} ədəd sifariş etmək olar`;
  }
  return null;
}

function validateCreateOrderBody(body) {
  const { customer_name, phone, note, items, client_request_id, expected_total, payment_method } = body;
  if (!customer_name || !String(customer_name).trim()) return 'Müştəri adı tələb olunur';
  if (String(customer_name).length > MAX_NAME) return `Ad ən çox ${MAX_NAME} simvol ola bilər`;
  if (!phone || !PHONE_RE.test(String(phone).trim())) return 'Düzgün telefon nömrəsi tələb olunur';
  if (String(phone).trim().length > MAX_PHONE) return `Telefon ən çox ${MAX_PHONE} simvol ola bilər`;
  if (note != null && String(note).length > MAX_NOTE) return `Qeyd ən çox ${MAX_NOTE} simvol ola bilər`;
  const itemsError = validateItems(items);
  if (itemsError) return itemsError;
  if (client_request_id != null && !CLIENT_REQUEST_ID_RE.test(String(client_request_id))) return 'client_request_id düzgün deyil';
  if (expected_total != null && (!Number.isFinite(Number(expected_total)) || Number(expected_total) < 0)) return 'expected_total düzgün deyil';
  if (payment_method != null && !PAYMENT_METHODS.includes(payment_method)) return 'Ödəniş üsulu düzgün deyil';
  return null;
}

function validateStatus(status) {
  return VALID_STATUSES.includes(status);
}

function validateId(id) {
  return Number.isInteger(id) && id > 0;
}

module.exports = { validateCreateOrderBody, validateItems, validateStatus, validateId, VALID_STATUSES };
