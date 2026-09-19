const { poolPromise } = require('../config/db');
const notificationService = require('./notificationService');
const { emitNotificationCreated } = require('../sockets/emit');

// Sistem xəbərdarlıqları (PDF 3.8): gözlənilməz server xətası və verilənlər bazasının əlçatmazlığı sahib/menecerə bildirilir.
// Eyni xəbərdarlıq spam yaratmasın deyə açar üzrə məhdudlaşdırılır.
const THROTTLE_MS = 10 * 60 * 1000;
const lastSent = new Map();

function throttled(key, now = Date.now()) {
  const previous = lastSent.get(key);
  if (previous && now - previous < THROTTLE_MS) return true;
  if (lastSent.size > 200) lastSent.clear();
  lastSent.set(key, now);
  return false;
}

async function report(key, title, body) {
  if (throttled(key)) return null;
  try {
    return await notificationService.create({ type: 'system_error', title, body: String(body || '').slice(0, 480) });
  } catch {
    // Verilənlər bazası çöküb — bildiriş yazıla bilmir; yenə də canlı adminlərə yazılmamış (müvəqqəti) xəbərdarlıq göndərilir
    try {
      const ephemeral = {
        id: -Date.now(), type: 'system_error', title, body: String(body || '').slice(0, 480),
        status: 'OPEN', is_read: false, created_at: new Date().toISOString(), ephemeral: true,
      };
      emitNotificationCreated(ephemeral);
      return ephemeral;
    } catch {
      return null;
    }
  }
}

// İstifadəçiyə stack trace göstərilmir (errorHandler); adminə isə qısa texniki məlumat gedir
function reportRequestError(req, err) {
  const path = String(req.originalUrl || '').split('?')[0];
  return report(`req:${req.method}:${path}:${err.message}`, 'Sistem xətası', `${req.method} ${path} — ${err.message}`);
}

// Dövri özünüyoxlama: DB ardıcıl `failuresBeforeAlert` dəfə cavab verməsə xəbərdarlıq; bərpa olunanda xəbər.
function startMonitor({ intervalMs = 60000, failuresBeforeAlert = 2 } = {}) {
  let failures = 0;
  let alerted = false;
  const timer = setInterval(async () => {
    try {
      const pool = await poolPromise;
      await pool.request().query('SELECT 1 AS ok');
      if (alerted) {
        lastSent.clear();
        await report('db-recovered', 'Verilənlər bazası bərpa olundu', 'Bağlantı yenidən işləyir');
      }
      failures = 0;
      alerted = false;
    } catch (err) {
      failures += 1;
      if (failures >= failuresBeforeAlert && !alerted) {
        alerted = true;
        await report('db-down', 'Verilənlər bazası əlçatan deyil', `${failures} ardıcıl yoxlama uğursuz oldu: ${err.message}`);
      }
    }
  }, intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}

const resetThrottle = () => lastSent.clear();

module.exports = { report, reportRequestError, startMonitor, throttled, resetThrottle, THROTTLE_MS };
