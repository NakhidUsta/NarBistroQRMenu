const round = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

// Bütün pul hesablaması burada (backend). Ardıcıllıq:
//   ara cəmi − endirim = vergi bazası → + servis haqqı → + ƏDV (baza+servis üzərindən) → + çatdırılma (yalnız takeaway)
// Qiymətlər ƏDV-siz hesab olunur; ƏDV üstünə əlavə edilir.
function compute({ subtotal, discount = 0, vatPercent = 0, serviceFeePercent = 0, deliveryFee = 0, isTakeaway = false }) {
  const sub = round(subtotal);
  const disc = Math.min(round(discount), sub);
  const taxable = round(sub - disc);
  const service_fee = round(taxable * (Number(serviceFeePercent) || 0) / 100);
  const vat = round((taxable + service_fee) * (Number(vatPercent) || 0) / 100);
  const delivery_fee = isTakeaway ? round(deliveryFee || 0) : 0;
  const total = round(taxable + service_fee + vat + delivery_fee);
  return { subtotal: sub, discount: disc, service_fee, vat, delivery_fee, total };
}

function settingsFrom(restaurant) {
  const r = restaurant || {};
  return {
    vatPercent: Number(r.vat_percent) || 0,
    serviceFeePercent: Number(r.service_fee_percent) || 0,
    deliveryFee: Number(r.delivery_fee) || 0,
    currency: r.currency || 'AZN',
  };
}

module.exports = { compute, settingsFrom, round };
