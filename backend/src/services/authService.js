const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const adminUserRepository = require('../repositories/adminUserRepository');
const AppError = require('../utils/AppError');
const { disconnectAdmin } = require('../sockets/emit');

const SESSION_HOURS = Number(process.env.ADMIN_SESSION_HOURS) || 12;
const TOKEN_EXPIRY = `${SESSION_HOURS}h`;
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;
const AUTH_CACHE_TTL_MS = 10_000;

// DB sorğularını azaltmaq üçün sessiya vəziyyəti qısa müddət yaddaşda saxlanılır;
// şifrə/rol dəyişəndə və çıxışda dərhal təmizlənir (bir server nüsxəsi üçün).
const authCache = new Map();
const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', 10);

function invalidate(userId) {
  authCache.delete(userId);
}

// Sessiyaları ləğv et: keşi təmizlə və açıq real-time bağlantıları qapat.
function revokeSessions(userId) {
  invalidate(userId);
  disconnectAdmin(userId);
}

function sign(admin) {
  const payload = { id: admin.id, email: admin.email, role: admin.role, restaurant_id: admin.restaurant_id, tv: admin.token_version };
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

function publicAdmin(admin) {
  return { id: admin.id, email: admin.email, role: admin.role, restaurant_id: admin.restaurant_id };
}

async function login(email, password) {
  const admin = await adminUserRepository.findByEmail(email);
  // Hesab mövcud olmasa da bcrypt müqayisəsi aparılır ki, cavab vaxtı ilə istifadəçi adı aşkar olmasın.
  const hash = admin?.password_hash || DUMMY_HASH;

  if (admin?.locked_until && new Date(admin.locked_until) > new Date()) {
    throw new AppError(429, 'Hesab çox sayda uğursuz cəhdə görə müvəqqəti bloklanıb. 15 dəqiqə sonra yenidən cəhd edin');
  }

  const match = await bcrypt.compare(password, hash);
  if (!admin || !match) {
    if (admin) {
      const state = await adminUserRepository.registerFailure(admin.id, MAX_FAILED_ATTEMPTS, LOCK_MINUTES);
      if (state && state.failed_attempts >= MAX_FAILED_ATTEMPTS) {
        throw new AppError(429, 'Hesab çox sayda uğursuz cəhdə görə müvəqqəti bloklanıb. 15 dəqiqə sonra yenidən cəhd edin');
      }
    }
    throw new AppError(401, 'Yanlış e-poçt və ya şifrə');
  }

  await adminUserRepository.resetFailures(admin.id);
  invalidate(admin.id);
  return { token: sign(admin), admin: publicAdmin(admin) };
}

// Hər admin sorğusunda: JWT imzası + DB-də token versiyası + CARİ rol (rol dəyişikliyi/silinmə dərhal qüvvəyə minir).
async function authenticate(token) {
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    throw new AppError(401, 'Sessiya etibarsızdır, yenidən daxil olun');
  }

  let state = authCache.get(payload.id);
  if (!state || Date.now() - state.at > AUTH_CACHE_TTL_MS) {
    const row = await adminUserRepository.findAuthState(payload.id);
    state = row ? { row, at: Date.now() } : null;
    if (state) authCache.set(payload.id, state);
    else authCache.delete(payload.id);
  }
  if (!state || state.row.token_version !== payload.tv) {
    throw new AppError(401, 'Sessiya etibarsızdır, yenidən daxil olun');
  }
  return { id: state.row.id, email: state.row.email, role: state.row.role, restaurant_id: state.row.restaurant_id };
}

async function changePassword(adminId, currentPassword, newPassword) {
  if (!newPassword || newPassword.length < 8) throw new AppError(400, 'Yeni şifrə ən azı 8 simvol olmalıdır');
  if (newPassword === currentPassword) throw new AppError(400, 'Yeni şifrə köhnə şifrədən fərqli olmalıdır');

  const state = await adminUserRepository.findAuthState(adminId);
  const full = state && (await adminUserRepository.findByEmail(state.email));
  if (!full || !(await bcrypt.compare(currentPassword || '', full.password_hash))) {
    throw new AppError(400, 'Cari şifrə yanlışdır');
  }

  const token_version = await adminUserRepository.updatePassword(adminId, await bcrypt.hash(newPassword, 10));
  revokeSessions(adminId);
  // Bu cihaz üçün yeni token verilir, digər bütün cihazlar çıxarılır.
  return { token: sign({ ...full, token_version }), admin: publicAdmin(full) };
}

async function logoutEverywhere(adminId) {
  const token_version = await adminUserRepository.bumpTokenVersion(adminId);
  revokeSessions(adminId);
  return token_version;
}

module.exports = { login, authenticate, changePassword, logoutEverywhere, invalidate, revokeSessions, SESSION_HOURS };
