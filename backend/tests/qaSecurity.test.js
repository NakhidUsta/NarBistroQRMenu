// QA təhlükəsizlik regressiyaları: F3 (çağırış üçün QR tokeni), F4 (masa siyahısı rolları), F6 (JWT alqoritmi sabit)
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { cookieFor } = require('./helpers');

jest.mock('../src/config/db', () => {
  const sql = jest.requireActual('mssql');
  const { fakePool } = require('./helpers');
  return { sql, poolPromise: Promise.resolve(fakePool) };
});
jest.mock('../src/repositories/adminUserRepository', () => {
  const { authStateFor } = require('./helpers');
  return { findAuthState: jest.fn(async (id) => authStateFor(id)) };
});
jest.mock('../src/services/auditService', () => ({ list: jest.fn().mockResolvedValue([]), log: jest.fn() }));
jest.mock('../src/repositories/tableRepository');
jest.mock('../src/repositories/notificationRepository');
jest.mock('../src/sockets/emit', () => ({ emitNotificationCreated: jest.fn(), emitTableUpdated: jest.fn(), getSocketStats: jest.fn() }));

const tableRepository = require('../src/repositories/tableRepository');
const notificationRepository = require('../src/repositories/notificationRepository');
const app = require('../src/app');

const TOKEN = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6';
const table = { id: 5, label: 'Masa 5', code: 'table_005', qr_token: TOKEN, is_active: true };

beforeEach(() => {
  jest.clearAllMocks();
  tableRepository.findByCode.mockResolvedValue(table);
  tableRepository.findAll.mockResolvedValue([table]);
  tableRepository.findById.mockResolvedValue(table);
  notificationRepository.findUnresolved.mockResolvedValue(null);
  notificationRepository.create.mockImplementation(async (n) => ({ id: 1, ...n }));
});

describe('F3: ofisiant çağırışı/hesab istəyi QR tokeni tələb edir', () => {
  const call = (path, body) => request(app).post(`/api/tables/table_005/${path}`).send(body);

  it.each(['call-waiter', 'request-bill'])('%s: token yoxdur / yanlışdır → 403, bildiriş YARANMIR; düzgün token → 201', async (path) => {
    expect((await call(path, {})).status).toBe(403);
    expect((await call(path, { token: 'yanlis' })).status).toBe(403);
    expect((await call(path, { token: TOKEN.slice(0, -1) + '0' })).status).toBe(403);
    expect((await call(path, { token: 12345 })).status).toBe(403);
    expect(notificationRepository.create).not.toHaveBeenCalled();
    expect((await call(path, { token: TOKEN })).status).toBe(201);
    expect(notificationRepository.create).toHaveBeenCalledTimes(1);
  });

  it('naməlum və ya deaktiv masa 404 (token doğru olsa belə)', async () => {
    tableRepository.findByCode.mockResolvedValue(null);
    expect((await call('call-waiter', { token: TOKEN })).status).toBe(404);
    tableRepository.findByCode.mockResolvedValue({ ...table, is_active: false });
    expect((await call('call-waiter', { token: TOKEN })).status).toBe(404);
    expect(notificationRepository.create).not.toHaveBeenCalled();
  });

  it('QR skanı: yanlış token 400, düzgün token keçir (sabit vaxtlı müqayisə)', async () => {
    tableRepository.registerScan.mockResolvedValue(table);
    expect((await request(app).post('/api/tables/table_005/scan').send({ token: 'yanlis' })).status).toBe(400);
    expect((await request(app).post('/api/tables/table_005/scan').send({ token: TOKEN })).status).toBe(200);
  });
});

describe('F4: GET /api/tables (qr_token daşıyır) yalnız OWNER/MANAGER/WAITER', () => {
  it('mətbəx 403, girişsiz 401, digər rollar 200', async () => {
    expect((await request(app).get('/api/tables')).status).toBe(401);
    expect((await request(app).get('/api/tables').set('Cookie', cookieFor('KITCHEN'))).status).toBe(403);
    expect((await request(app).get('/api/tables/5').set('Cookie', cookieFor('KITCHEN'))).status).toBe(403);
    for (const role of ['OWNER', 'MANAGER', 'WAITER']) {
      expect((await request(app).get('/api/tables').set('Cookie', cookieFor(role))).status).toBe(200);
    }
  });
});

describe('F6: JWT yalnız HS256 qəbul edir', () => {
  const payload = { id: 1, email: 'owner@test.local', role: 'OWNER', restaurant_id: 1, tv: 0 };
  const get = (token) => request(app).get('/api/tables').set('Cookie', [`qrmenu_token=${token}`]);

  it('düzgün HS256 token keçir; HS512, "none" alqoritmi, yanlış imza və dəyişdirilmiş rol rədd edilir (401)', async () => {
    expect((await get(jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' }))).status).toBe(200);
    expect((await get(jwt.sign(payload, process.env.JWT_SECRET, { algorithm: 'HS512', expiresIn: '1h' }))).status).toBe(401);
    const none = `${Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url')}.${Buffer.from(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.`;
    expect((await get(none)).status).toBe(401);
    expect((await get(jwt.sign(payload, 'basqa-sirr', { expiresIn: '1h' }))).status).toBe(401);
    const expired = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: -10 });
    expect((await get(expired)).status).toBe(401);
    const good = jwt.sign({ ...payload, role: 'WAITER' }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const [h, , s] = good.split('.');
    const forgedBody = Buffer.from(JSON.stringify({ ...payload, role: 'OWNER', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url');
    expect((await get(`${h}.${forgedBody}.${s}`)).status).toBe(401);
  });
});
