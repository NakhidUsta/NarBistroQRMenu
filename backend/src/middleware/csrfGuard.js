const AppError = require('../utils/AppError');

// CSRF qoruması. Production-da sessiya cookie-si SameSite=None olduğundan brauzer onu başqa saytdan gələn sorğularla da göndərir;
// CORS isə yalnız cavabı gizlədir, sorğunun özünü dayandırmır (gövdəsiz/form/text-plain POST "sadə sorğu"dur, preflight yoxdur).
// Ona görə state-dəyişən sorğularda mənbəni özümüz yoxlayırıq: brauzer POST/PUT/PATCH/DELETE-də həmişə Origin göndərir və
// onu JavaScript ilə saxtalaşdırmaq olmur.
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
// Ödəniş provayderinin server-server bildirişi brauzerdən gəlmir; imza ilə qorunur
const EXEMPT_PATHS = ['/payments/epoint/callback'];

const stripSlash = (v) => String(v || '').trim().replace(/\/+$/, '').toLowerCase();

function allowedOrigins(req) {
  const set = new Set([process.env.CLIENT_ORIGIN, process.env.PUBLIC_URL, 'http://localhost:5174'].filter(Boolean).map(stripSlash));
  // öz saytımızın Origin-i: sorğu eyni host-a gedirsə və Origin həmin host-dursa (frontend backend tərəfindən təqdim olunanda)
  set.add(stripSlash(`${req.protocol}://${req.get('host')}`));
  return set;
}

function csrfGuard(req, res, next) {
  if (SAFE_METHODS.has(req.method) || EXEMPT_PATHS.includes(req.path)) return next();

  const origin = req.get('origin');
  if (origin !== undefined) {
    // "null" (sandbox iframe, bəzi yönləndirmələr) etibarsız sayılır
    if (!allowedOrigins(req).has(stripSlash(origin))) return next(new AppError(403, 'Sorğu etibarsız mənbədən gəlir'));
    return next();
  }
  // Origin yoxdur: brauzer deyil (curl, server-server, testlər) və ya köhnə brauzer. Müasir brauzerlər Sec-Fetch-Site göndərir.
  if (req.get('sec-fetch-site') === 'cross-site') return next(new AppError(403, 'Sorğu etibarsız mənbədən gəlir'));
  return next();
}

module.exports = csrfGuard;
