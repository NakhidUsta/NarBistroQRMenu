const request = require('supertest');
const bcrypt = require('bcryptjs');
const { cookieFor, authStateFor } = require('./helpers');

jest.mock('../src/config/db', () => {
  const sql = jest.requireActual('mssql');
  const { fakePool } = require('./helpers');
  return { sql, poolPromise: Promise.resolve(fakePool) };
});
jest.mock('../src/repositories/adminUserRepository');
jest.mock('../src/repositories/adminSessionRepository');
jest.mock('../src/services/auditService', () => ({ list: jest.fn().mockResolvedValue([]), log: jest.fn() }));
jest.mock('../src/sockets/emit', () => ({ disconnectAdmin: jest.fn(), disconnectSession: jest.fn() }));

const users = require('../src/repositories/adminUserRepository');
const sessions = require('../src/repositories/adminSessionRepository');
const authService = require('../src/services/authService');
const app = require('../src/app');

const hash = bcrypt.hashSync('Correct123!', 4);
const future = (ms) => new Date(Date.now() + ms);
const cookieHeader = (res, name) => (res.headers['set-cookie'] || []).find((c) => c.startsWith(`${name}=`)) || '';
const cookieValue = (res, name) => decodeURIComponent(cookieHeader(res, name).split(';')[0].split('=').slice(1).join('='));

beforeEach(() => {
  jest.clearAllMocks();
  authService.invalidate(1);
  users.findAuthState.mockImplementation(async (id) => authStateFor(id));
  users.findByEmail.mockResolvedValue({ id: 1, email: 'owner@test.local', role: 'OWNER', restaurant_id: 1, password_hash: hash, token_version: 0, failed_attempts: 0, locked_until: null });
  users.resetFailures.mockResolvedValue();
  sessions.createSession.mockResolvedValue({ id: 11, expires_at: future(7 * 86400_000) });
  sessions.insertToken.mockResolvedValue();
  sessions.purgeOld.mockResolvedValue();
  sessions.touchSession.mockResolvedValue();
  sessions.revokeSession.mockResolvedValue(true);
});

describe('POST /api/auth/login — cookie-lər', () => {
  it('access və refresh cookie-lərini httpOnly verir; refresh yalnız /api/auth yoluna; tokenlər cavab gövdəsində YOXDUR', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'owner@test.local', password: 'Correct123!' });
    expect(res.status).toBe(200);
    const access = cookieHeader(res, 'qrmenu_token');
    const refresh = cookieHeader(res, 'qrmenu_refresh');
    expect(access).toMatch(/HttpOnly/i);
    expect(access).not.toMatch(/Path=\/api\/auth/i);
    expect(access).toMatch(/Max-Age=900/); // 15 dəq
    expect(refresh).toMatch(/HttpOnly/i);
    expect(refresh).toMatch(/Path=\/api\/auth/i);
    expect(JSON.stringify(res.body)).not.toContain(cookieValue(res, 'qrmenu_refresh'));
    expect(res.body.admin).toMatchObject({ email: 'owner@test.local', role: 'OWNER' });
  });
});

describe('POST /api/auth/refresh', () => {
  const stored = (over = {}) => ({
    id: 5, session_id: 11, admin_user_id: 1, expires_at: future(3600_000), used_at: null,
    session_expires_at: future(86400_000), session_revoked_at: null, ...over,
  });

  it('düzgün refresh cookie ilə yeni access + ROTASİYA olunmuş yeni refresh cookie verir', async () => {
    sessions.findTokenByHash.mockResolvedValue(stored());
    sessions.markTokenUsed.mockResolvedValue(true);
    const res = await request(app).post('/api/auth/refresh').set('Cookie', ['qrmenu_refresh=old-refresh-token']);
    expect(res.status).toBe(200);
    expect(res.body.admin.email).toBe('owner@test.local');
    expect(cookieValue(res, 'qrmenu_refresh')).not.toBe('old-refresh-token');
    expect(cookieValue(res, 'qrmenu_refresh').length).toBeGreaterThan(40);
    expect(cookieHeader(res, 'qrmenu_token')).toMatch(/HttpOnly/i);
    expect(sessions.markTokenUsed).toHaveBeenCalledWith(5);
  });

  it('cookie yoxdursa 401 və cookie-lər təmizlənir', async () => {
    const res = await request(app).post('/api/auth/refresh');
    expect(res.status).toBe(401);
    expect(cookieHeader(res, 'qrmenu_token')).toMatch(/Expires=Thu, 01 Jan 1970/);
    expect(cookieHeader(res, 'qrmenu_refresh')).toMatch(/Expires=Thu, 01 Jan 1970/);
  });

  it('köhnə (istifadə olunmuş) token təkrar təqdim edilsə 401 verir və sessiya bağlanır', async () => {
    sessions.findTokenByHash.mockResolvedValue(stored({ used_at: new Date(Date.now() - 120_000) }));
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const res = await request(app).post('/api/auth/refresh').set('Cookie', ['qrmenu_refresh=stolen']);
    warn.mockRestore();
    expect(res.status).toBe(401);
    expect(sessions.revokeSession).toHaveBeenCalledWith(11);
  });
});

describe('logout və cihaz sessiyaları', () => {
  it('logout refresh sessiyasını bağlayır və hər iki cookie-ni silir', async () => {
    sessions.findTokenByHash.mockResolvedValue({ session_id: 11 });
    const res = await request(app).post('/api/auth/logout').set('Cookie', ['qrmenu_refresh=abc']);
    expect(res.status).toBe(200);
    expect(sessions.revokeSession).toHaveBeenCalledWith(11);
    expect(cookieHeader(res, 'qrmenu_token')).toMatch(/Expires=Thu, 01 Jan 1970/);
    expect(cookieHeader(res, 'qrmenu_refresh')).toMatch(/Path=\/api\/auth/i);
  });

  it('logout giriş etməmiş istifadəçiyə də xəta vermir', async () => {
    expect((await request(app).post('/api/auth/logout')).status).toBe(200);
  });

  it('GET /api/auth/sessions yalnız giriş etmişə açıqdır və öz cihazlarını qaytarır', async () => {
    expect((await request(app).get('/api/auth/sessions')).status).toBe(401);
    sessions.listActive.mockResolvedValue([{ id: 1, user_agent: 'Chrome', ip: '1.1.1.1' }]);
    const res = await request(app).get('/api/auth/sessions').set('Cookie', cookieFor('OWNER'));
    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ id: 1, user_agent: 'Chrome', ip: '1.1.1.1', current: false }]);
    expect(sessions.listActive).toHaveBeenCalledWith(1);
  });

  it('DELETE /api/auth/sessions/:id: yanlış ID 400, başqasının sessiyası 404, öz sessiyası 204', async () => {
    const del = (id) => request(app).delete(`/api/auth/sessions/${id}`).set('Cookie', cookieFor('OWNER'));
    expect((await del('abc')).status).toBe(400);
    sessions.findSession.mockResolvedValue({ id: 5, admin_user_id: 2 });
    expect((await del(5)).status).toBe(404);
    sessions.findSession.mockResolvedValue({ id: 6, admin_user_id: 1 });
    expect((await del(6)).status).toBe(204);
    expect(sessions.revokeSession).toHaveBeenCalledWith(6);
  });
});
