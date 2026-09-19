const request = require('supertest');
const { cookieFor, authStateFor } = require('./helpers');

jest.mock('../src/config/db', () => {
  const sql = jest.requireActual('mssql');
  const { fakePool } = require('./helpers');
  return { sql, poolPromise: Promise.resolve(fakePool) };
});
jest.mock('../src/repositories/adminUserRepository');
jest.mock('../src/repositories/adminSessionRepository');
jest.mock('../src/repositories/emailTokenRepository');
jest.mock('../src/services/mailService');
jest.mock('../src/services/restaurantService', () => ({ getRestaurant: jest.fn().mockResolvedValue({ name: 'Savora' }) }));
jest.mock('../src/services/auditService', () => ({ list: jest.fn().mockResolvedValue([]), log: jest.fn() }));
jest.mock('../src/utils/logger', () => ({ error: jest.fn(), warn: jest.fn() }));
jest.mock('../src/sockets/emit', () => ({ disconnectAdmin: jest.fn(), disconnectSession: jest.fn() }));

const users = require('../src/repositories/adminUserRepository');
const sessions = require('../src/repositories/adminSessionRepository');
const tokens = require('../src/repositories/emailTokenRepository');
const mail = require('../src/services/mailService');
const audit = require('../src/services/auditService');
const app = require('../src/app');

const future = (ms) => new Date(Date.now() + ms);
const flush = () => new Promise((r) => setImmediate(r));
const cleared = (res, name) => (res.headers['set-cookie'] || []).some((c) => c.startsWith(`${name}=`) && /Expires=Thu, 01 Jan 1970/.test(c));

beforeEach(() => {
  jest.clearAllMocks();
  mail.isConfigured.mockReturnValue(true);
  mail.send.mockResolvedValue({});
  users.findAuthState.mockImplementation(async (id) => ({ ...authStateFor(id), email_verified_at: null }));
  users.findByEmail.mockResolvedValue({ id: 1, email: 'owner@test.local', role: 'OWNER' });
  users.setEmailVerified.mockResolvedValue();
  users.updatePassword.mockResolvedValue(1);
  tokens.countRecent.mockResolvedValue(0);
  tokens.invalidateOpen.mockResolvedValue();
  tokens.create.mockResolvedValue();
  tokens.markUsed.mockResolvedValue(true);
  sessions.revokeAllForUser.mockResolvedValue();
});

describe('GET /api/auth/config', () => {
  it('yalnız e-poçt xidmətinin qurulub-qurulmadığını bildirir (heç bir həssas sahə yox)', async () => {
    const on = await request(app).get('/api/auth/config');
    expect(on.body).toEqual({ password_reset: true });
    mail.isConfigured.mockReturnValue(false);
    const off = await request(app).get('/api/auth/config');
    expect(off.body).toEqual({ password_reset: false });
  });
});

describe('POST /api/auth/forgot-password', () => {
  const post = (email) => request(app).post('/api/auth/forgot-password').send({ email });

  it('mövcud və mövcud olmayan e-poçt EYNİ status və gövdə qaytarır (hesab açıqlanmır)', async () => {
    const known = await post('owner@test.local');
    users.findByEmail.mockResolvedValue(null);
    const unknown = await post('yox@test.local');
    expect(known.status).toBe(200);
    expect(unknown.status).toBe(200);
    expect(known.body).toEqual(unknown.body);
    expect(known.body.message).toContain('qeydiyyatlıdırsa');
    await flush();
    expect(mail.send).toHaveBeenCalledTimes(1); // yalnız mövcud hesaba
  });

  it('e-poçt xidməti qurulmayıbsa da cavab eynidir (400/503 ilə vəziyyət sızmır)', async () => {
    mail.isConfigured.mockReturnValue(false);
    const res = await post('owner@test.local');
    expect(res.status).toBe(200);
    expect(mail.send).not.toHaveBeenCalled();
  });

  it.each([[undefined], [''], ['ünvan-deyil'], [12345], [{ $ne: 1 }], ['a@b.co'.padEnd(200, 'x')]])('yanlış e-poçt %p → 400', async (email) => {
    expect((await post(email)).status).toBe(400);
  });

  it('cavabda token, hash və ya "hesab tapıldı" kimi heç bir iz yoxdur', async () => {
    const res = await post('owner@test.local');
    await flush();
    expect(JSON.stringify(res.body)).not.toMatch(/token|hash|owner@test/i);
  });
});

describe('POST /api/auth/reset-password', () => {
  const stored = (over = {}) => ({ id: 3, admin_user_id: 1, purpose: 'reset', expires_at: future(600_000), used_at: null, email: 'owner@test.local', ...over });
  const post = (body) => request(app).post('/api/auth/reset-password').send(body);

  it('uğurlu: şifrə dəyişir, cookie-lər təmizlənir, audit loga yazılır', async () => {
    tokens.findByHash.mockResolvedValue(stored());
    const res = await post({ token: 'abc', new_password: 'YeniSifre123' });
    expect(res.status).toBe(200);
    expect(res.body.message).toContain('Şifrə dəyişdirildi');
    expect(cleared(res, 'qrmenu_token')).toBe(true);
    expect(cleared(res, 'qrmenu_refresh')).toBe(true);
    expect(audit.log).toHaveBeenCalledWith(expect.anything(), 'auth.password_reset_email', 'admin_users', 1, null, null);
    expect(sessions.revokeAllForUser).toHaveBeenCalledWith(1);
  });

  it('etibarsız/istifadə olunmuş/vaxtı bitmiş link 400; token təkrar istifadə olunmur', async () => {
    tokens.findByHash.mockResolvedValue(null);
    expect((await post({ token: 'yox', new_password: 'YeniSifre123' })).status).toBe(400);
    tokens.findByHash.mockResolvedValue(stored({ used_at: new Date() }));
    expect((await post({ token: 'used', new_password: 'YeniSifre123' })).status).toBe(400);
    tokens.findByHash.mockResolvedValue(stored({ expires_at: future(-5) }));
    expect((await post({ token: 'old', new_password: 'YeniSifre123' })).status).toBe(400);
    expect(users.updatePassword).not.toHaveBeenCalled();
  });

  it('zəif şifrə 400, gövdə yoxdursa da 500 yox 400', async () => {
    tokens.findByHash.mockResolvedValue(stored());
    expect((await post({ token: 'abc', new_password: '123' })).status).toBe(400);
    expect((await request(app).post('/api/auth/reset-password')).status).toBe(400);
  });
});

describe('e-poçt təsdiqi və sınaq məktubu', () => {
  it('POST /send-verification: giriş tələb edir; uğurlu olanda məktub gedir', async () => {
    expect((await request(app).post('/api/auth/send-verification')).status).toBe(401);
    const res = await request(app).post('/api/auth/send-verification').set('Cookie', cookieFor('MANAGER'));
    expect(res.status).toBe(200);
    expect(mail.send).toHaveBeenCalledWith(expect.objectContaining({ to: 'manager@test.local' }));
  });

  it('artıq təsdiqlənmiş hesab 409 alır', async () => {
    users.findAuthState.mockImplementation(async (id) => ({ ...authStateFor(id), email_verified_at: new Date() }));
    expect((await request(app).post('/api/auth/send-verification').set('Cookie', cookieFor('OWNER'))).status).toBe(409);
  });

  it('POST /verify-email: düzgün token təsdiqləyir, yanlış 400', async () => {
    tokens.findByHash.mockResolvedValue({ id: 9, admin_user_id: 2, purpose: 'verify', expires_at: future(1000), used_at: null, email: 'm@x.az' });
    const ok = await request(app).post('/api/auth/verify-email').send({ token: 'good' });
    expect(ok.status).toBe(200);
    expect(users.setEmailVerified).toHaveBeenCalledWith(2);
    tokens.findByHash.mockResolvedValue(null);
    expect((await request(app).post('/api/auth/verify-email').send({ token: 'bad' })).status).toBe(400);
  });

  it('POST /test-mail yalnız OWNER-ə açıqdır; SMTP xətası (502) səbəbi ilə qayıdır', async () => {
    expect((await request(app).post('/api/auth/test-mail')).status).toBe(401);
    expect((await request(app).post('/api/auth/test-mail').set('Cookie', cookieFor('MANAGER'))).status).toBe(403);
    expect((await request(app).post('/api/auth/test-mail').set('Cookie', cookieFor('WAITER'))).status).toBe(403);
    const ok = await request(app).post('/api/auth/test-mail').set('Cookie', cookieFor('OWNER'));
    expect(ok.status).toBe(200);
    expect(ok.body.message).toContain('owner@test.local');

    const AppError = require('../src/utils/AppError'); // real mailService AppError atır (5xx yalnız AppError ilə istifadəçiyə açılır)
    mail.send.mockRejectedValueOnce(new AppError(502, 'Gmail girişi qəbul olunmadı — Tətbiq şifrəsi'));
    const bad = await request(app).post('/api/auth/test-mail').set('Cookie', cookieFor('OWNER'));
    expect(bad.status).toBe(502);
    expect(bad.body.error).toContain('Tətbiq şifrəsi');
  });
});
