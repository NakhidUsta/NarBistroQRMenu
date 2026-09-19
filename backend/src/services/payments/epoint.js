// Epoint.az (Azərbaycan) — kart ödənişi. Kart səhifəsi Epoint-də açılır: kart nömrəsi/CVV bizim serverdən KEÇMİR (PCI yükü yoxdur).
//
// Protokol (epoint.az API v1):
//   sorğu  : POST {apiBase}/request  form: data = base64(JSON), signature = base64(sha1(private_key + data + private_key))
//   cavab  : { status: "success", transaction, redirect_url }
//   callback: Epoint merchant panelində göstərilən "Result URL"-ə POST (data, signature) — eyni imza sxemi ilə yoxlanılır
//   status : POST {apiBase}/get-status  data = { public_key, transaction }
// DİQQƏT: bu adapter Epoint sənədinə görə yazılıb; canlıya çıxmazdan əvvəl öz sandbox/açarlarınızla bir test ödənişi edin.
const crypto = require('crypto');
const paymentsConfig = require('../../config/payments');

const ALLOWED_REDIRECT_HOSTS = ['epoint.az'];

const sign = (data, privateKey) => crypto.createHash('sha1').update(privateKey + data + privateKey).digest('base64');
const toData = (obj) => Buffer.from(JSON.stringify(obj), 'utf8').toString('base64');

function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function cfg() {
  return paymentsConfig.get().epoint;
}

function isConfigured() {
  return !!(cfg().publicKey && cfg().privateKey);
}

// Açıq yönləndirmənin (open redirect) qarşısı: provayderin cavabındakı ünvan yalnız etibarlı domendə ola bilər
function assertSafeRedirect(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('Provayder yanlış ödəniş ünvanı qaytardı');
  }
  const okHost = ALLOWED_REDIRECT_HOSTS.some((h) => parsed.hostname === h || parsed.hostname.endsWith(`.${h}`));
  if (parsed.protocol !== 'https:' || !okHost) throw new Error('Provayder etibarsız ödəniş ünvanı qaytardı');
  return parsed.toString();
}

async function post(path, payload) {
  const { privateKey, apiBase } = cfg();
  const data = toData(payload);
  const body = new URLSearchParams({ data, signature: sign(data, privateKey) });
  const res = await fetch(`${apiBase}/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    signal: AbortSignal.timeout(15000),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Epoint cavabı oxuna bilmədi (HTTP ${res.status})`);
  }
  if (!res.ok) throw new Error(`Epoint xətası (HTTP ${res.status})`);
  return json;
}

// Epoint statusunu bizim statusa çevirir
function mapStatus(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'success') return 'success';
  if (s === 'returned' || s === 'refunded') return 'refunded';
  if (s === 'error' || s === 'failed' || s === 'fail') return 'failed';
  return 'pending'; // "new" və s. — ödəniş hələ tamamlanmayıb
}

function normalizeResult(d) {
  return {
    providerOrderId: d.order_id != null ? String(d.order_id) : null,
    status: mapStatus(d.status),
    transaction: d.transaction || null,
    amount: d.amount != null ? Number(d.amount) : null,
    cardMask: d.card_mask || null,
    message: d.message || null,
  };
}

async function createPayment({ providerOrderId, amount, currency, description, language, successUrl, errorUrl, resultUrl }) {
  const payload = {
    public_key: cfg().publicKey,
    amount: Number(Number(amount).toFixed(2)),
    currency,
    language: ['az', 'en', 'ru'].includes(language) ? language : 'az',
    order_id: providerOrderId,
    description: String(description || '').slice(0, 250),
    success_redirect_url: successUrl,
    error_redirect_url: errorUrl,
  };
  if (cfg().sendResultUrl && resultUrl) payload.result_url = resultUrl;
  const json = await post('request', payload);
  if (String(json.status).toLowerCase() !== 'success' || !json.redirect_url) {
    throw new Error(`Epoint ödənişi başlatmadı${json.message ? `: ${json.message}` : ''}`);
  }
  return { redirectUrl: assertSafeRedirect(json.redirect_url), transaction: json.transaction || null };
}

// Callback: imza etibarsızdırsa heç nə qəbul edilmir
function parseCallback({ data, signature }) {
  if (typeof data !== 'string' || typeof signature !== 'string' || !isConfigured()) return { valid: false };
  if (!safeEqual(sign(data, cfg().privateKey), signature)) return { valid: false };
  try {
    return { valid: true, result: normalizeResult(JSON.parse(Buffer.from(data, 'base64').toString('utf8'))) };
  } catch {
    return { valid: false };
  }
}

// Callback gəlməyəndə (şəbəkə/localhost) provayderdən cari statusu özümüz soruşuruq
async function fetchStatus({ transaction }) {
  if (!transaction) return null;
  const json = await post('get-status', { public_key: cfg().publicKey, transaction });
  return normalizeResult({ ...json, transaction: json.transaction || transaction });
}

module.exports = { name: 'epoint', isConfigured, createPayment, parseCallback, fetchStatus, sign, assertSafeRedirect };
