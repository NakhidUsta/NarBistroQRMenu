const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const adminUserRepository = require('../repositories/adminUserRepository');
const sessionRepository = require('../repositories/adminSessionRepository');
const AppError = require('../utils/AppError');
const logger = require('../utils/logger');
const { disconnectAdmin, disconnectSession } = require('../sockets/emit');

// Token modeli:
//  • access token — qısa ömürlü JWT (defolt 15 dəq), httpOnly cookie; hər sorğuda DB-də sessiya/token versiyası/cari rol yoxlanılır;
//  • refresh token — təsadüfi (DB-də yalnız SHA-256 hash-i), httpOnly cookie (yalnız /api/auth yoluna göndərilir),
//    hər yenilənmədə ROTASİYA olunur; artıq istifadə olunmuş token təkrar təqdim edilərsə (oğurluq əlaməti) bütün sessiya bağlanır.
const ACCESS_MINUTES = Number(process.env.ACCESS_TOKEN_MINUTES) || 15;
const ACCESS_EXPIRY = `${ACCESS_MINUTES}m`;
const SESSION_HOURS = Number(process.env.ADMIN_SESSION_HOURS) || 12; // refresh token-in "boş qalma" müddəti (hər yenilənmədə yenidən başlayır)
const SESSION_MAX_DAYS = Number(process.env.ADMIN_SESSION_MAX_DAYS) || 7; // sessiyanın mütləq ömrü
const REUSE_GRACE_MS = 10_000; // eyni anda iki tab eyni refresh token-i göndərsə bu pəncərədə oğurluq sayılmır
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;
const AUTH_CACHE_TTL_MS = 10_000;

// DB sorğularını azaltmaq üçün sessiya vəziyyəti qısa müddət yaddaşda saxlanılır;
// şifrə/rol dəyişəndə və çıxışda dərhal təmizlənir (bir server nüsxəsi üçün).
const authCache = new Map();
const sessionCache = new Map();
const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', 10);

const hashToken = (raw) => crypto.createHash('sha256').update(raw).digest('hex');
const addMs = (ms) => new Date(Date.now() + ms);

function invalidate(userId) {
  authCache.delete(userId);
}

// Sessiyaları ləğv et: keşi təmizlə və açıq real-time bağlantıları qapat.
function revokeSessions(userId) {
  invalidate(userId);
  sessionCache.clear();
  disconnectAdmin(userId);
}

function signAccess(admin, sessionId) {
  const payload = { id: admin.id, email: admin.email, role: admin.role, restaurant_id: admin.restaurant_id, tv: admin.token_version };
  if (sessionId) payload.sid = sessionId;
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: ACCESS_EXPIRY });
}

function publicAdmin(admin) {
  return { id: admin.id, email: admin.email, role: admin.role, restaurant_id: admin.restaurant_id, email_verified: !!admin.email_verified_at };
}

// Yeni refresh token yaradır (yalnız hash saxlanılır); vaxtı sessiyanın mütləq ömründən uzun ola bilməz
async function issueRefreshToken(sessionId, sessionExpiresAt) {
  const raw = crypto.randomBytes(48).toString('base64url');
  const idleExpiry = addMs(SESSION_HOURS * 3600 * 1000);
  const expires_at = idleExpiry < new Date(sessionExpiresAt) ? idleExpiry : new Date(sessionExpiresAt);
  await sessionRepository.insertToken({ session_id: sessionId, token_hash: hashToken(raw), expires_at });
  return { raw, expires_at };
}

async function startSession(admin, meta = {}) {
  const session = await sessionRepository.createSession({
    admin_user_id: admin.id,
    user_agent: String(meta.userAgent || '').slice(0, 300),
    ip: meta.ip,
    expires_at: addMs(SESSION_MAX_DAYS * 24 * 3600 * 1000),
  });
  const refresh = await issueRefreshToken(session.id, session.expires_at);
  return { token: signAccess(admin, session.id), refreshToken: refresh.raw, sessionId: session.id };
}

async function login(email, password, meta = {}) {
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
  const { token, refreshToken } = await startSession(admin, meta);
  sessionRepository.purgeOld().catch(() => {}); // vaxtaşırı təmizlik — girişi gecikdirmir
  return { token, refreshToken, admin: publicAdmin(admin) };
}

async function sessionIsActive(sid) {
  const cached = sessionCache.get(sid);
  if (cached && Date.now() - cached.at <= AUTH_CACHE_TTL_MS) return cached.ok;
  const row = await sessionRepository.findSession(sid);
  const ok = !!row && !row.revoked_at && new Date(row.expires_at) > new Date();
  sessionCache.set(sid, { ok, at: Date.now() });
  return ok;
}

// Hər admin sorğusunda: JWT imzası + sessiya ləğv edilməyib + DB-də token versiyası + CARİ rol (rol dəyişikliyi/silinmə dərhal qüvvəyə minir).
async function authenticate(token) {
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] }); // alqoritm sabitdir (alg-confusion/none hücumlarına qarşı)
  } catch {
    throw new AppError(401, 'Sessiya etibarsızdır, yenidən daxil olun');
  }

  // sid — cihaz sessiyası. Bu mexanizmdən əvvəl verilmiş köhnə tokenlərdə yoxdur (qısa ömürlüdür, tezliklə bitir).
  if (payload.sid && !(await sessionIsActive(payload.sid))) {
    throw new AppError(401, 'Sessiya bağlanıb, yenidən daxil olun');
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
  return {
    id: state.row.id, email: state.row.email, role: state.row.role, restaurant_id: state.row.restaurant_id,
    email_verified: !!state.row.email_verified_at, sid: payload.sid,
  };
}

// Refresh token ilə yeni access + yeni refresh token (rotasiya)
async function refresh(rawToken, meta = {}) {
  const invalid = () => new AppError(401, 'Sessiya bitib, yenidən daxil olun');
  if (!rawToken || typeof rawToken !== 'string') throw invalid();

  const row = await sessionRepository.findTokenByHash(hashToken(rawToken));
  if (!row) throw invalid();
  if (row.session_revoked_at || new Date(row.session_expires_at) <= new Date() || new Date(row.expires_at) <= new Date()) throw invalid();

  // Bu token artıq rotasiya olunub. Qısa pəncərədə (paralel tab) normaldır, sonra isə oğurluq əlamətidir → sessiya bağlanır.
  const alreadyUsed = row.used_at && Date.now() - new Date(row.used_at).getTime() > REUSE_GRACE_MS;
  if (alreadyUsed) {
    await sessionRepository.revokeSession(row.session_id);
    sessionCache.delete(row.session_id);
    disconnectSession(row.session_id);
    logger.warn('Refresh token təkrar istifadə olundu — sessiya təhlükəsizlik üçün bağlandı', { session: row.session_id, admin: row.admin_user_id });
    throw new AppError(401, 'Sessiya təhlükəsizlik səbəbindən bağlandı, yenidən daxil olun');
  }
  if (!row.used_at) {
    const won = await sessionRepository.markTokenUsed(row.id);
    if (!won) {
      // paralel sorğu bizdən əvvəl istifadə etdi — pəncərə daxilində olduğu üçün davam edirik
      logger.warn('Refresh token paralel istifadə edildi (pəncərə daxilində)', { session: row.session_id });
    }
  }

  const state = await adminUserRepository.findAuthState(row.admin_user_id);
  if (!state) throw invalid();

  const next = await issueRefreshToken(row.session_id, row.session_expires_at);
  await sessionRepository.touchSession(row.session_id, { user_agent: meta.userAgent && String(meta.userAgent).slice(0, 300), ip: meta.ip });
  invalidate(state.id);
  return { token: signAccess(state, row.session_id), refreshToken: next.raw, admin: publicAdmin(state), sessionId: row.session_id };
}

// Cari cihazdan çıxış: yalnız bu sessiya bağlanır (digər cihazlar qalır)
async function logout({ refreshToken, sessionId } = {}) {
  let sid = sessionId;
  if (!sid && refreshToken) {
    const row = await sessionRepository.findTokenByHash(hashToken(refreshToken));
    sid = row?.session_id;
  }
  if (!sid) return;
  await sessionRepository.revokeSession(sid);
  sessionCache.delete(sid);
  disconnectSession(sid);
}

async function listSessions(userId, currentSessionId) {
  const rows = await sessionRepository.listActive(userId);
  return rows.map((s) => ({ ...s, current: s.id === currentSessionId }));
}

// Başqa cihazın sessiyasını bağla (yalnız öz sessiyaların)
async function revokeSession(userId, sessionId) {
  const session = await sessionRepository.findSession(sessionId);
  if (!session || session.admin_user_id !== userId) throw new AppError(404, 'Sessiya tapılmadı');
  await sessionRepository.revokeSession(sessionId);
  sessionCache.delete(sessionId);
  disconnectSession(sessionId);
}

async function changePassword(adminId, currentPassword, newPassword, meta = {}) {
  if (!newPassword || newPassword.length < 8) throw new AppError(400, 'Yeni şifrə ən azı 8 simvol olmalıdır');
  if (newPassword === currentPassword) throw new AppError(400, 'Yeni şifrə köhnə şifrədən fərqli olmalıdır');

  const state = await adminUserRepository.findAuthState(adminId);
  const full = state && (await adminUserRepository.findByEmail(state.email));
  if (!full || !(await bcrypt.compare(currentPassword || '', full.password_hash))) {
    throw new AppError(400, 'Cari şifrə yanlışdır');
  }

  const token_version = await adminUserRepository.updatePassword(adminId, await bcrypt.hash(newPassword, 10));
  await sessionRepository.revokeAllForUser(adminId);
  revokeSessions(adminId);
  // Bu cihaz üçün yeni sessiya verilir, digər bütün cihazlar çıxarılır.
  const { token, refreshToken } = await startSession({ ...full, token_version }, meta);
  return { token, refreshToken, admin: publicAdmin(full) };
}

// E-poçtla şifrə sıfırlama: cari şifrəni bilmədən yenisini təyin edir, bütün sessiyaları bağlayır, bloku götürür
async function resetPasswordByEmail(adminId, newPassword) {
  if (!newPassword || newPassword.length < 8) throw new AppError(400, 'Yeni şifrə ən azı 8 simvol olmalıdır');
  await adminUserRepository.updatePassword(adminId, await bcrypt.hash(newPassword, 10)); // token versiyasını da artırır
  await sessionRepository.revokeAllForUser(adminId);
  revokeSessions(adminId);
}

async function logoutEverywhere(adminId) {
  const token_version = await adminUserRepository.bumpTokenVersion(adminId);
  await sessionRepository.revokeAllForUser(adminId);
  revokeSessions(adminId);
  return token_version;
}

module.exports = {
  login, refresh, logout, authenticate, changePassword, resetPasswordByEmail, logoutEverywhere, listSessions, revokeSession,
  invalidate, revokeSessions, SESSION_HOURS, ACCESS_MINUTES, SESSION_MAX_DAYS, REUSE_GRACE_MS, hashToken,
};
