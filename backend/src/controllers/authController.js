const authService = require('../services/authService');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');

const COOKIE_NAME = 'qrmenu_token';
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 gün

const cookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  maxAge: COOKIE_MAX_AGE,
});

exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) throw new AppError(400, 'E-poçt və şifrə tələb olunur');

  const { token, admin } = await authService.login(email, password);
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
