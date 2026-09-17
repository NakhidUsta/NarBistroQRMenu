const promoRepository = require('../repositories/promoRepository');
const AppError = require('../utils/AppError');

const DEFAULT_RESTAURANT_ID = 1;

async function listPromoCodes() {
  return promoRepository.findAll();
}

async function createPromoCode(body) {
  return promoRepository.create({ ...body, restaurant_id: DEFAULT_RESTAURANT_ID });
}

async function updatePromoCode(id, body) {
  const promo = await promoRepository.update(id, body);
  if (!promo) throw new AppError(404, 'Promo kod tapılmadı');
  return promo;
}

async function deletePromoCode(id) {
  const deleted = await promoRepository.remove(id);
  if (!deleted) throw new AppError(404, 'Promo kod tapılmadı');
}

// Sifariş tranzaksiyası daxilində çağırılır — backend-only hesablama (PDF bölmə 2.8).
async function validateAndCompute(transaction, code, subtotal) {
  const promo = await promoRepository.findByCodeTx(transaction, code);
  if (!promo || !promo.is_active) throw new AppError(400, 'Promo kod tapılmadı və ya aktiv deyil');

  const now = new Date();
  if (promo.starts_at && now < new Date(promo.starts_at)) throw new AppError(400, 'Promo kodun müddəti hələ başlamayıb');
  if (promo.ends_at && now > new Date(promo.ends_at)) throw new AppError(400, 'Promo kodun müddəti bitib');
  if (promo.usage_limit !== null && promo.usage_count >= promo.usage_limit) {
    throw new AppError(400, 'Promo kodun istifadə limiti bitib');
  }
  if (subtotal < Number(promo.min_order_amount)) {
    throw new AppError(400, `Bu promo kod üçün minimum sifariş məbləği ${Number(promo.min_order_amount).toFixed(2)} ₼ olmalıdır`);
  }

  const discount = promo.discount_type === 'PERCENT'
    ? Math.round(subtotal * (Number(promo.discount_value) / 100) * 100) / 100
    : Number(promo.discount_value);

  return { promo, discount: Math.min(discount, subtotal) };
}

module.exports = { listPromoCodes, createPromoCode, updatePromoCode, deletePromoCode, validateAndCompute };
