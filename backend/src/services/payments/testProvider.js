// Sınaq provayderi (PAYMENT_PROVIDER=test): real pul hərəkəti yoxdur — özümüzün "saxta ödəniş səhifəsi" (/pay/test) açılır
// və orada "Uğurlu / Uğursuz" seçilir. Yalnız inkişaf və demo üçündür: production-da (NODE_ENV=production) heç vaxt aktiv olmur.
const crypto = require('crypto');
const paymentsConfig = require('../../config/payments');

function secret() {
  return process.env.JWT_SECRET || 'dev-secret';
}

const signOrder = (providerOrderId) => crypto.createHmac('sha256', secret()).update(`test-pay:${providerOrderId}`).digest('hex');

function verifySig(providerOrderId, sig) {
  if (typeof sig !== 'string') return false;
  const a = Buffer.from(signOrder(providerOrderId));
  const b = Buffer.from(sig);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const isConfigured = () => process.env.NODE_ENV !== 'production';

async function createPayment({ providerOrderId }) {
  const { publicUrl } = paymentsConfig.get();
  const url = `${publicUrl}/pay/test?o=${encodeURIComponent(providerOrderId)}&sig=${signOrder(providerOrderId)}`;
  return { redirectUrl: url, transaction: `test-${providerOrderId}` };
}

module.exports = { name: 'test', isConfigured, createPayment, verifySig, signOrder, parseCallback: () => ({ valid: false }), fetchStatus: async () => null, refund: async () => ({ ok: true }) };
