// F1: hesab məlum defolt şifrə ilə işləyirsə, /api/auth/me və login cavabı "default_password" bayrağı qaytarır (panel xəbərdarlıq göstərir).
// Şifrənin özü heç vaxt saxlanmır/qaytarılmır — yalnız bayraq.
const request = require('supertest');
const bcrypt = require('bcryptjs');
const { cookieFor } = require('./helpers');

jest.mock('../src/config/db', () => {
  const sql = jest.requireActual('mssql');
  const { fakePool } = require('./helpers');
  return { sql, poolPromise: Promise.resolve(fakePool) };
});
jest.mock('../src/repositories/adminUserRepository');
jest.mock('../src/repositories/adminSessionRepository');
jest.mock('../src/services/auditService', () => ({ list: jest.fn().mockResolvedValue([]), log: jest.fn() }));
jest.mock('../src/utils/logger', () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn() }));

const users = require('../src/repositories/adminUserRepository');
const sessions = require('../src/repositories/adminSessionRepository');
const logger = require('../src/utils/logger');
const authService = require('../src/services/authService');
const app = require('../src/app');

const ROLE_BY_ID = { 1: 'OWNER', 2: 'MANAGER', 3: 'WAITER' };
const admin = (id) => ({ id, email: `${ROLE_BY_ID[id].toLowerCase()}@test.local`, role: ROLE_BY_ID[id], restaurant_id: 1, token_version: 0 });
const hashes = { default: bcrypt.hashSync('ChangeMe123!', 4), strong: bcrypt.hashSync('CoxGucluSifre#9271', 4) };
// hər test ayrı hesab (id) istifadə edir — nəticə 60 san keşlənir və id ilə açarlanır
const me = (role) => request(app).get('/api/auth/me').set('Cookie', cookieFor(role));

beforeEach(() => {
  jest.clearAllMocks();
  users.findAuthState.mockImplementation(async (id) => ({ ...admin(id), email_verified_at: null }));
});

describe('F1: defolt şifrə aşkarlanması', () => {
  it('məlum defolt şifrələr tanınır; başqaları yox', () => {
    expect(authService.isKnownDefaultPassword('ChangeMe123!')).toBe(true);
    expect(authService.isKnownDefaultPassword('change-this-password')).toBe(true);
    expect(authService.isKnownDefaultPassword('CoxGucluSifre#9271')).toBe(false);
    expect(authService.isKnownDefaultPassword('')).toBe(false);
  });

  it('/me: hash defolt şifrənindirsə default_password=true (cavabda hash/şifrə yoxdur); güclü şifrədirsə bayraq YOXDUR', async () => {
    users.findByEmail.mockImplementation(async (email) => ({ ...admin(1), email, password_hash: hashes.default }));
    const bad = await me('OWNER');
    expect(bad.status).toBe(200);
    expect(bad.body.admin.default_password).toBe(true);
    expect(JSON.stringify(bad.body)).not.toMatch(/password_hash|ChangeMe/);

    users.findByEmail.mockImplementation(async (email) => ({ ...admin(2), email, password_hash: hashes.strong }));
    const good = await me('MANAGER');
    expect(good.status).toBe(200);
    expect(good.body.admin.default_password).toBeUndefined();
  });

  it('şifrə dəyişəndə keş dərhal silinir: bayraq növbəti /me-də yox olur (60 san gözləmədən)', async () => {
    users.findByEmail.mockImplementation(async (email) => ({ ...admin(3), email, password_hash: hashes.default }));
    expect((await me('WAITER')).body.admin.default_password).toBe(true);
    // istifadəçi şifrəni dəyişir (sonrakı sessiya addımları mock olduğundan xəta ola bilər — keş isə ondan ƏVVƏL silinir)
    users.updatePassword.mockResolvedValue(1);
    sessions.revokeAllForUser.mockResolvedValue();
    await authService.changePassword(3, 'ChangeMe123!', 'YeniGucluSifre#5531').catch(() => {});
    users.findByEmail.mockImplementation(async (email) => ({ ...admin(3), email, password_hash: hashes.strong }));
    expect((await me('WAITER')).body.admin.default_password).toBeUndefined();
  });

  it('server açılışında defolt şifrə varsa xəbərdarlıq yazılır (şifrə dəyişdirilmir); güclüdürsə yazılmır', async () => {
    users.findByEmail.mockResolvedValue({ ...admin(1), id: 31, password_hash: hashes.default });
    expect(await authService.warnIfDefaultAdminPassword()).toBe(true);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('defolt şifrədədir'));
    expect(users.updatePassword).not.toHaveBeenCalled();
    logger.warn.mockClear();
    users.findByEmail.mockResolvedValue({ ...admin(1), id: 32, password_hash: hashes.strong });
    expect(await authService.warnIfDefaultAdminPassword()).toBe(false);
    expect(logger.warn).not.toHaveBeenCalled();
  });
});
