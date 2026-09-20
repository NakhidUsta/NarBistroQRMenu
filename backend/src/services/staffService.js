const bcrypt = require('bcryptjs');
const adminUserRepository = require('../repositories/adminUserRepository');
const authService = require('./authService');
const AppError = require('../utils/AppError');
const { assertPasswordAcceptable } = require('../utils/passwordPolicy');

const DEFAULT_RESTAURANT_ID = 1;
const ROLES = ['OWNER', 'MANAGER', 'WAITER', 'KITCHEN'];

const validatePassword = (password) => assertPasswordAcceptable(password, 'Şifrə');

async function list() {
  return adminUserRepository.findAll();
}

async function create({ email, password, role }) {
  if (typeof email !== 'string' || email.length > 150 || !/^\S+@\S+\.\S+$/.test(email)) throw new AppError(400, 'Düzgün e-poçt tələb olunur');
  if (!ROLES.includes(role)) throw new AppError(400, `Rol bunlardan biri olmalıdır: ${ROLES.join(', ')}`);
  validatePassword(password);
  if (await adminUserRepository.findByEmail(email)) throw new AppError(409, 'Bu e-poçt artıq istifadə olunur');

  const password_hash = await bcrypt.hash(password, 10);
  return adminUserRepository.create({ restaurant_id: DEFAULT_RESTAURANT_ID, email, password_hash, role });
}

async function update(id, { role, password }, actingAdminId) {
  const target = await adminUserRepository.findById(id);
  if (!target) throw new AppError(404, 'İstifadəçi tapılmadı');
  if (!ROLES.includes(role)) throw new AppError(400, `Rol bunlardan biri olmalıdır: ${ROLES.join(', ')}`);
  if (target.role === 'OWNER' && role !== 'OWNER' && (await adminUserRepository.countByRole('OWNER')) <= 1) {
    throw new AppError(400, 'Sistemdə ən azı bir OWNER qalmalıdır');
  }
  let password_hash;
  if (password) {
    validatePassword(password);
    password_hash = await bcrypt.hash(password, 10);
  }
  const updated = await adminUserRepository.update(id, { role, password_hash });
  authService.revokeSessions(id); // rol/şifrə dəyişikliyi dərhal qüvvəyə minsin
  return updated;
}

async function remove(id, actingAdminId) {
  if (id === actingAdminId) throw new AppError(400, 'Öz hesabınızı silə bilməzsiniz');
  const target = await adminUserRepository.findById(id);
  if (!target) throw new AppError(404, 'İstifadəçi tapılmadı');
  if (target.role === 'OWNER' && (await adminUserRepository.countByRole('OWNER')) <= 1) {
    throw new AppError(400, 'Sistemdə ən azı bir OWNER qalmalıdır');
  }
  await adminUserRepository.remove(id);
  authService.revokeSessions(id);
}

module.exports = { list, create, update, remove };
