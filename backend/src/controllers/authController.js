const authService = require('../services/authService');
const auditService = require('../services/auditService');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');

const COOKIE_NAME = 'qrmenu_token';
const COOKIE_MAX_AGE = authService.SESSION_HOURS * 60 * 60 * 1000;

const cookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  maxAge: COOKIE_MAX_AGE,
});

exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) throw new AppError(400, 'E-poçt və şifrə tələb olunur');

  const { token, admin } = await authService.login(String(email), String(password));
  req.admin = admin;
  await auditService.log(req, 'auth.login', 'admin_users', admin.id, null, { email: admin.email });
  res.cookie(COOKIE_NAME, token, cookieOptions());
  res.json({ admin });
});

exports.logout = (req, res) => {
  res.clearCookie(COOKIE_NAME, cookieOptions());
  res.json({ message: 'Çıxış edildi' });
};

exports.me = (req, res) => {
  res.json({ admin: req.admin });
};

exports.changePassword = asyncHandler(async (req, res) => {
  const { current_password, new_password } = req.body;
  const { token, admin } = await authService.changePassword(req.admin.id, current_password, new_password);
  await auditService.log(req, 'auth.password_change', 'admin_users', admin.id, null, null);
  res.cookie(COOKIE_NAME, token, cookieOptions());
  res.json({ admin, message: 'Şifrə dəyişdirildi, digər cihazlardan çıxış edildi' });
});

exports.logoutEverywhere = asyncHandler(async (req, res) => {
  await authService.logoutEverywhere(req.admin.id);
  await auditService.log(req, 'auth.logout_all', 'admin_users', req.admin.id, null, null);
  res.clearCookie(COOKIE_NAME, cookieOptions());
  res.json({ message: 'Bütün cihazlardan çıxış edildi' });
});
