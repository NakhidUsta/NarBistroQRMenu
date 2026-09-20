// Təhlükəsizlik başlıqları (QA F5): HSTS (production), CSP, Permissions-Policy.
// - /api və /uploads cavabları sənəd deyil: `default-src 'none'` — cavab brauzerdə açılsa belə heç nə icra olunmur.
// - HTML səhifə (spa.js) üçün CSP hər sorğuda qurulur: inline splash skripti `'unsafe-inline'` ilə deyil, SHA-256 hash ilə icazə alır.
const crypto = require('crypto');

const API_CSP = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'";

function originOf(value) {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

// HTML-dəki icra olunan inline <script> bloklarının hash-ləri (src-siz; JSON-LD kimi "data" bloklar icra olunmur, CSP-yə tabe deyil)
function inlineScriptHashes(html) {
  const hashes = [];
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    const attrs = m[1];
    if (/\bsrc\s*=/i.test(attrs)) continue;
    const type = /\btype\s*=\s*["']?([^"'\s>]+)/i.exec(attrs)?.[1] || '';
    if (type && !/^(module|text\/javascript|application\/javascript)$/i.test(type)) continue;
    if (!m[2].trim()) continue;
    hashes.push(`'sha256-${crypto.createHash('sha256').update(m[2], 'utf8').digest('base64')}'`);
  }
  return hashes;
}

function buildPageCsp(html, env = process.env, selfOrigin) {
  const production = env.NODE_ENV === 'production';
  // API və socket eyni mənşədədir ('self'); bəzi brauzerlər 'self'-i ws:/wss: üçün saymır, ona görə açıq yazılır (ws/wss variantı ilə)
  const extra = [env.PUBLIC_URL, env.CLIENT_ORIGIN, selfOrigin].map(originOf).filter(Boolean);
  const connect = ["'self'", ...new Set(extra.flatMap((o) => [o, o.replace(/^http/, 'ws')]))];
  const directives = [
    "default-src 'self'",
    `script-src 'self' ${inlineScriptHashes(html).join(' ')}`.trim(),
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com", // React style atributları və splash <style> üçün
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https:", // məhsul şəkilləri admin tərəfindən verilən xarici (https) URL ola bilər
    `connect-src ${connect.join(' ')}`,
    "media-src 'self' data: blob:",
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];
  if (production) directives.push('upgrade-insecure-requests');
  return directives.join('; ');
}

function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(self), interest-cohort=()');
  // Yalnız HTTPS üzərindən keçən cavablarda mənalıdır; HTTP-də brauzerlər onsuz da nəzərə almır
  if (process.env.NODE_ENV === 'production') res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) res.setHeader('Content-Security-Policy', API_CSP);
  next();
}

module.exports = { securityHeaders, buildPageCsp, inlineScriptHashes, API_CSP };
