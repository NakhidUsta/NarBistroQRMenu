const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const adminUserRepository = require('../repositories/adminUserRepository');
const emailTokenRepository = require('../repositories/emailTokenRepository');
const authService = require('./authService');
const mailService = require('./mailService');
const mailTemplates = require('./mailTemplates');
const restaurantService = require('./restaurantService');
const AppError = require('../utils/AppError');
const logger = require('../utils/logger');

// E-poçtla şifrə sıfırlama və e-poçt təsdiqi.
// Təhlükəsizlik: token təsadüfi (256 bit), DB-də yalnız SHA-256 hash-i; birdəfəlik; qısa ömürlü; hər hesab üçün eyni anda
// yalnız bir etibarlı link; "unudulmuş şifrə" sorğusu hesabın mövcudluğunu AÇMIR (həmişə eyni cavab); link Host başlığından
// deyil, konfiqurasiyadan (PUBLIC_URL) qurulur (Host-header injection yoxdur).
const RESET_MINUTES = 30;
const VERIFY_HOURS = 24;
const MAX_TOKENS_PER_HOUR = 3;

const hashToken = (raw) => crypto.createHash('sha256').update(raw).digest('hex');

function baseUrl() {
  return (process.env.PUBLIC_URL || process.env.CLIENT_ORIGIN || 'http://localhost:5174').replace(/\/+$/, '');
}

async function restaurantName() {
  try {
    return (await restaurantService.getRestaurant()).name || 'QR Menu';
  } catch {
    return 'QR Menu';
  }
}

async function issueToken(adminId, purpose, ttlMs) {
  await emailTokenRepository.invalidateOpen(adminId, purpose);
  const raw = crypto.randomBytes(32).toString('base64url');
  await emailTokenRepository.create({ admin_user_id: adminId, purpose, token_hash: hashToken(raw), expires_at: new Date(Date.now() + ttlMs) });
  return raw;
}

const isAvailable = () => mailService.isConfigured();

// Cavab həmişə eynidir (hesab var/yox, məktub getdi/getmədi) — istifadəçi adı sızmasın. Axtarış və göndərmə ARXA PLANDA gedir və gözlənilmir:
// əks halda mövcud hesabda cavab (məktub göndərilənə qədər) daha gec gələr və vaxt fərqi ilə hesab aşkar olardı.
async function requestPasswordReset(email) {
  if (!mailService.isConfigured()) {
    logger.warn('Şifrə sıfırlama tələbi gəldi, lakin e-poçt xidməti qurulmayıb (SMTP_USER/SMTP_PASS)');
    return;
  }
  const work = (async () => {
    const admin = await adminUserRepository.findByEmail(String(email).trim());
    if (!admin) return;
    if ((await emailTokenRepository.countRecent(admin.id, 'reset', 60)) >= MAX_TOKENS_PER_HOUR) return; // sui-istifadə: saatda ən çox 3 məktub
    const token = await issueToken(admin.id, 'reset', RESET_MINUTES * 60 * 1000);
    const restaurant = await restaurantName();
    const link = `${baseUrl()}/admin/reset-password?token=${encodeURIComponent(token)}`;
    await mailService.send({ to: admin.email, senderName: restaurant, ...mailTemplates.passwordReset({ link, restaurant, minutes: RESET_MINUTES }) });
  })();
  work.catch((err) => logger.error('Şifrə sıfırlama məktubu göndərilmədi', err)); // xəta yalnız jurnala, istifadəçiyə heç vaxt
}

// Tokeni yoxlayır (atomik istifadə) və qüvvədə olanı qaytarır
async function consumeToken(rawToken, purpose) {
  const bad = () => new AppError(400, 'Link etibarsızdır və ya vaxtı bitib — yenisini tələb edin');
  if (!rawToken || typeof rawToken !== 'string' || rawToken.length > 200) throw bad();
  const row = await emailTokenRepository.findByHash(hashToken(rawToken));
  if (!row || row.purpose !== purpose || row.used_at || new Date(row.expires_at) <= new Date()) throw bad();
  if (!(await emailTokenRepository.markUsed(row.id))) throw bad(); // paralel istifadə — yalnız biri qalib gəlir
  return row;
}

async function resetPassword(rawToken, newPassword) {
  if (!newPassword || newPassword.length < 8) throw new AppError(400, 'Yeni şifrə ən azı 8 simvol olmalıdır');
  const row = await consumeToken(rawToken, 'reset');
  await authService.resetPasswordByEmail(row.admin_user_id, newPassword);
  await adminUserRepository.setEmailVerified(row.admin_user_id); // sıfırlama linkini aça bilməsi ünvanın sahibi olduğunu sübut edir
  return { id: row.admin_user_id, email: row.email };
}

async function sendVerification(adminId) {
  if (!mailService.isConfigured()) throw new AppError(503, 'E-poçt xidməti qurulmayıb');
  const state = await adminUserRepository.findAuthState(adminId);
  if (!state) throw new AppError(404, 'İstifadəçi tapılmadı');
  if (state.email_verified_at) throw new AppError(409, 'E-poçt artıq təsdiqlənib');
  if ((await emailTokenRepository.countRecent(adminId, 'verify', 60)) >= MAX_TOKENS_PER_HOUR) {
    throw new AppError(429, 'Çox sayda təsdiq məktubu istənildi — bir saat sonra yenidən cəhd edin');
  }
  const token = await issueToken(adminId, 'verify', VERIFY_HOURS * 3600 * 1000);
  const restaurant = await restaurantName();
  const link = `${baseUrl()}/admin/verify-email?token=${encodeURIComponent(token)}`;
  await mailService.send({ to: state.email, senderName: restaurant, ...mailTemplates.emailVerification({ link, restaurant, hours: VERIFY_HOURS }) });
}

async function verifyEmail(rawToken) {
  const row = await consumeToken(rawToken, 'verify');
  await adminUserRepository.setEmailVerified(row.admin_user_id);
  return { id: row.admin_user_id, email: row.email };
}

// Öz e-poçtunu dəyişir (şifrəni unutdda məktub real ünvana getsin). Cari şifrə tələb olunur (oğurlanmış sessiya ünvanı dəyişib hesabı
// ələ keçirməsin). Köhnə ünvana verilmiş bütün açıq linklər (sıfırlama/təsdiq) ləğv edilir; yeni ünvan təsdiqlənənə qədər "təsdiqlənməyib".
async function changeEmail(adminId, currentPassword, newEmailRaw) {
  const newEmail = String(newEmailRaw || '').trim();
  if (!/^\S+@\S+\.\S+$/.test(newEmail) || newEmail.length > 150) throw new AppError(400, 'Düzgün e-poçt ünvanı yazın');
  const state = await adminUserRepository.findAuthState(adminId);
  if (!state) throw new AppError(404, 'İstifadəçi tapılmadı');
  const full = await adminUserRepository.findByEmail(state.email);
  if (!full || !(await bcrypt.compare(String(currentPassword || ''), full.password_hash))) throw new AppError(400, 'Cari şifrə yanlışdır');
  if (newEmail.toLowerCase() === String(state.email).toLowerCase()) throw new AppError(400, 'Bu artıq sizin e-poçtunuzdur');
  if (await adminUserRepository.findByEmail(newEmail)) throw new AppError(409, 'Bu e-poçt artıq başqa hesabda istifadə olunur');

  await adminUserRepository.updateEmail(adminId, newEmail);
  await emailTokenRepository.invalidateOpen(adminId, 'reset');
  await emailTokenRepository.invalidateOpen(adminId, 'verify');

  // Yeni ünvana təsdiq məktubu (xidmət qurulmayıbsa və ya xəta olarsa e-poçt yenə də dəyişilib, sonra "Təsdiq məktubu göndər" ilə təkrar olunur)
  let verificationSent = false;
  if (mailService.isConfigured()) {
    try {
      await sendVerification(adminId);
      verificationSent = true;
    } catch (err) {
      logger.error('Yeni e-poçta təsdiq məktubu göndərilmədi', err);
    }
  }
  return { email: newEmail, previous: state.email, verificationSent };
}

// SMTP ayarlarının düzgünlüyünü yoxlamaq üçün: sınaq məktubu öz ünvanına
async function sendTestMail(adminId) {
  const state = await adminUserRepository.findAuthState(adminId);
  if (!state) throw new AppError(404, 'İstifadəçi tapılmadı');
  const restaurant = await restaurantName();
  await mailService.send({ to: state.email, senderName: restaurant, ...mailTemplates.testMail({ restaurant }) });
  return { to: state.email };
}

module.exports = {
  isAvailable, requestPasswordReset, resetPassword, sendVerification, verifyEmail, sendTestMail, changeEmail,
  hashToken, RESET_MINUTES, VERIFY_HOURS, MAX_TOKENS_PER_HOUR,
};
