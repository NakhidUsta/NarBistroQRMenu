const authService = require('../services/authService');
const auditService = require('../services/auditService');
const accountEmailService = require('../services/accountEmailService');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');

const ACCESS_COOKIE = 'qrmenu_token';
const REFRESH_COOKIE = 'qrmenu_refresh';
const REFRESH_PATH = '/api/auth'; // refresh token yalnız auth endpoint-lərinə göndərilir — digər sorğularda ifşa olunmur

const baseCookie = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
});
const accessCookie = () => ({ ...baseCookie(), maxAge: authService.ACCESS_MINUTES * 60 * 1000 });
const refreshCookie = () => ({ ...baseCookie(), path: REFRESH_PATH, maxAge: authService.SESSION_HOURS * 60 * 60 * 1000 });

const clientMeta = (req) => ({ ip: req.ip, userAgent: req.get('user-agent') });

function setSessionCookies(res, { token, refreshToken }) {
  res.cookie(ACCESS_COOKIE, token, accessCookie());
  res.cookie(REFRESH_COOKIE, refreshToken, refreshCookie());
}

function clearSessionCookies(res) {
  res.clearCookie(ACCESS_COOKIE, baseCookie());
  res.clearCookie(REFRESH_COOKIE, { ...baseCookie(), path: REFRESH_PATH });
}

exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) throw new AppError(400, 'E-poçt və şifrə tələb olunur');

  const session = await authService.login(String(email), String(password), clientMeta(req));
  req.admin = session.admin;
  await auditService.log(req, 'auth.login', 'admin_users', session.admin.id, null, { email: session.admin.email });
  setSessionCookies(res, session);
  res.json({ admin: session.admin });
});

// Access token vaxtı bitəndə səssiz yenilənmə: yeni access + ROTASİYA olunmuş yeni refresh token
exports.refresh = asyncHandler(async (req, res) => {
  try {
    const session = await authService.refresh(req.cookies?.[REFRESH_COOKIE], clientMeta(req));
    setSessionCookies(res, session);
    res.json({ admin: session.admin });
  } catch (err) {
    if (err.status === 401) clearSessionCookies(res);
    throw err;
  }
});

// Yalnız cari cihazdan çıxış (sessiya bağlanır, refresh token etibarsız olur)
exports.logout = asyncHandler(async (req, res) => {
  await authService.logout({ refreshToken: req.cookies?.[REFRESH_COOKIE] }).catch(() => {});
  clearSessionCookies(res);
  res.json({ message: 'Çıxış edildi' });
});

exports.me = (req, res) => {
  res.json({ admin: req.admin });
};

exports.changePassword = asyncHandler(async (req, res) => {
  const { current_password, new_password } = req.body;
  const session = await authService.changePassword(req.admin.id, current_password, new_password, clientMeta(req));
  await auditService.log(req, 'auth.password_change', 'admin_users', session.admin.id, null, null);
  setSessionCookies(res, session);
  res.json({ admin: session.admin, message: 'Şifrə dəyişdirildi, digər cihazlardan çıxış edildi' });
});

exports.logoutEverywhere = asyncHandler(async (req, res) => {
  await authService.logoutEverywhere(req.admin.id);
  await auditService.log(req, 'auth.logout_all', 'admin_users', req.admin.id, null, null);
  clearSessionCookies(res);
  res.json({ message: 'Bütün cihazlardan çıxış edildi' });
});

exports.listSessions = asyncHandler(async (req, res) => {
  res.json(await authService.listSessions(req.admin.id, req.admin.sid));
});

exports.revokeSession = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new AppError(400, 'Yanlış sessiya ID-si');
  await authService.revokeSession(req.admin.id, id);
  await auditService.log(req, 'auth.session_revoke', 'admin_sessions', id, null, null);
  res.status(204).send();
});

// E-poçt xidməti qurulubmu (şifrə sıfırlama düyməsini göstərmək üçün). Yalnız bool — həssas məlumat yoxdur.
exports.config = (req, res) => {
  res.json({ password_reset: accountEmailService.isAvailable() });
};

const FORGOT_MESSAGE = 'Bu e-poçt ünvanı qeydiyyatlıdırsa, şifrə sıfırlama linki göndərildi. Gələnlər qutusunu (və spam qovluğunu) yoxlayın.';

// Hesabın mövcudluğu açıqlanmır: e-poçt qeydiyyatlı olsa da olmasa da eyni cavab (200) qaytarılır
exports.forgotPassword = asyncHandler(async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim() : '';
  if (!email || email.length > 150 || !email.includes('@')) throw new AppError(400, 'Düzgün e-poçt ünvanı daxil edin');
  await accountEmailService.requestPasswordReset(email);
  res.json({ message: FORGOT_MESSAGE });
});

exports.resetPassword = asyncHandler(async (req, res) => {
  const { token, new_password } = req.body || {};
  const user = await accountEmailService.resetPassword(token, new_password);
  req.admin = { id: user.id, email: user.email };
  await auditService.log(req, 'auth.password_reset_email', 'admin_users', user.id, null, null);
  clearSessionCookies(res);
  res.json({ message: 'Şifrə dəyişdirildi. İndi yeni şifrə ilə daxil ola bilərsiniz.' });
});

exports.sendVerification = asyncHandler(async (req, res) => {
  await accountEmailService.sendVerification(req.admin.id);
  res.json({ message: 'Təsdiq məktubu göndərildi — e-poçtunuzu yoxlayın.' });
});

exports.verifyEmail = asyncHandler(async (req, res) => {
  const user = await accountEmailService.verifyEmail(req.body?.token);
  req.admin = { id: user.id, email: user.email };
  await auditService.log(req, 'auth.email_verified', 'admin_users', user.id, null, { email: user.email });
  res.json({ message: 'E-poçt təsdiqləndi.' });
});

// SMTP ayarlarını yoxlamaq: sınaq məktubu öz ünvanına (yalnız OWNER)
exports.testMail = asyncHandler(async (req, res) => {
  const { to } = await accountEmailService.sendTestMail(req.admin.id);
  res.json({ message: `Sınaq məktubu göndərildi: ${to}` });
});
