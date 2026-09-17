const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const adminUserRepository = require('../repositories/adminUserRepository');
const AppError = require('../utils/AppError');

const TOKEN_EXPIRY = '7d';

async function login(email, password) {
  const admin = await adminUserRepository.findByEmail(email);
  if (!admin) throw new AppError(401, 'Yanlış e-poçt və ya şifrə');

  const match = await bcrypt.compare(password, admin.password_hash);
  if (!match) throw new AppError(401, 'Yanlış e-poçt və ya şifrə');

  const payload = {
    id: admin.id,
    email: admin.email,
    role: admin.role,
    restaurant_id: admin.restaurant_id,
  };
  const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: TOKEN_EXPIRY });

  return { token, admin: payload };
}

module.exports = { login };
