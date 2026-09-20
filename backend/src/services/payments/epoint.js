// Epoint.az (Azərbaycan) — kart ödənişi. Kart səhifəsi Epoint-də açılır: kart nömrəsi/CVV bizim serverdən KEÇMİR (PCI yükü yoxdur).
//
// Epoint rəsmi sənədinə (API Epoint EN, version 1.0.3) görə yazılıb və ona qarşı yoxlanılıb:
//   sorğu   : POST https://epoint.az/api/1/request  — data = base64(JSON), signature = base64(sha1(private_key + data + private_key), binary)
//             cavab: { status: "success"|"error", transaction, redirect_url }  (redirect_url-ə yönləndirilir)
//   callback: Epoint sizin qeydiyyatdan keçirdiyiniz "result_url"-ə POST (data, signature) göndərir; imza eyni sxemlə yoxlanılır.
//             result_url SORĞUDA deyil, merchant qurulanda Epoint-ə bildirilir (success_url / error_url da)
//   status  : POST /get-status  data = { public_key, transaction } → new | success | returned | error | server_error
//   geri qaytarma: POST /reverse  data = { public_key, language, transaction, amount?, currency } → { status, message }
//   sağlamlıq: GET https://epoint.az/api/heartbeat → { status: "ok" }
// Valyuta yalnız AZN, dil az|en|ru, order_id ≤ 255 simvol, description ≤ 1000 simvol.
// Kart səhifəsi Epoint-dədir: kart nömrəsi/CVV bizim serverdən keçmir.
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
  if (currency !== 'AZN') throw new Error('Epoint yalnız AZN valyutasını qəbul edir (Ayarlar → Valyuta kodu AZN olmalıdır)');
  const payload = {
    public_key: cfg().publicKey,
    amount: Number(Number(amount).toFixed(2)),
    currency,
    language: ['az', 'en', 'ru'].includes(language) ? language : 'az',
    order_id: providerOrderId,
    description: String(description || '').slice(0, 1000),
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

// Tam geri qaytarma (Epoint "reverse"): tranzaksiya ID-si ilə. Uğursuzluqda xəta atır.
async function refund({ transaction, amount, currency, language }) {
  if (!transaction) throw new Error('Tranzaksiya ID-si yoxdur');
  const payload = { public_key: cfg().publicKey, language: ['az', 'en', 'ru'].includes(language) ? language : 'az', transaction, currency: currency || 'AZN' };
  if (amount != null) payload.amount = Number(Number(amount).toFixed(2));
  const json = await post('reverse', payload);
  if (String(json.status).toLowerCase() !== 'success') throw new Error(json.message || 'Epoint geri qaytarmanı qəbul etmədi');
  return { ok: true };
}

// Epoint əlçatandırmı (hazırlıq yoxlaması üçün) — imza tələb etmir
async function heartbeat() {
  const base = cfg().apiBase.replace(/\/api\/1$/, '');
  const res = await fetch(`${base}/api/heartbeat`, { signal: AbortSignal.timeout(10000) });
  const json = await res.json().catch(() => ({}));
  return res.ok && json.status === 'ok';
}

module.exports = { name: 'epoint', isConfigured, createPayment, parseCallback, fetchStatus, refund, heartbeat, sign, assertSafeRedirect };
