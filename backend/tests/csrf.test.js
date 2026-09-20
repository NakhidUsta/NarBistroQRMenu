// CSRF qoruması: production-da cookie SameSite=None olduğundan başqa sayt gövdəsiz "sadə" POST ilə (məs. refund, QR regenerasiya,
// logout-all) girişli adminin adından əməliyyat edə bilərdi. Cross-site mənbədən gələn state-dəyişən sorğular 403 almalıdır.
const request = require('supertest');
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
jest.mock('../src/repositories/orderRepository');
jest.mock('../src/repositories/paymentRepository');
jest.mock('../src/repositories/tableRepository');
jest.mock('../src/sockets/emit', () => ({ emitOrderStatusUpdated: jest.fn(), emitProductUpdated: jest.fn(), emitOrderCreated: jest.fn(), emitTableUpdated: jest.fn(), getSocketStats: jest.fn() }));

const orderRepository = require('../src/repositories/orderRepository');
const tableRepository = require('../src/repositories/tableRepository');
const app = require('../src/app');

const EVIL = 'https://evil.example';
const post = (path, headers = {}) => {
  let r = request(app).post(path).set('Cookie', cookieFor('OWNER'));
  for (const [k, v] of Object.entries(headers)) r = r.set(k, v);
  return r;
};

beforeEach(() => {
  jest.clearAllMocks();
  orderRepository.findById.mockResolvedValue(null); // handler-ə çatan sorğu 404 alır (403 deyil)
  tableRepository.findById.mockResolvedValue(null);
});

describe('CSRF guard', () => {
  it('başqa saytın Origin-i ilə state-dəyişən sorğu 403 alır və handler işləmir', async () => {
    for (const path of ['/api/orders/10/refund', '/api/tables/5/regenerate', '/api/auth/logout-all', '/api/orders/10/payment']) {
      const res = await post(path, { Origin: EVIL });
      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/mənbə/);
    }
    expect(orderRepository.findById).not.toHaveBeenCalled();
    expect(tableRepository.findById).not.toHaveBeenCalled();
  });

  it('Origin: null (sandbox iframe / bəzi form göndərişləri) və Sec-Fetch-Site: cross-site (Origin-siz) də bloklanır', async () => {
    expect((await post('/api/orders/10/refund', { Origin: 'null' })).status).toBe(403);
    expect((await post('/api/orders/10/refund', { 'Sec-Fetch-Site': 'cross-site' })).status).toBe(403);
    expect((await post('/api/orders/10/refund', { 'Sec-Fetch-Site': 'same-site', Origin: EVIL })).status).toBe(403);
  });

  it('etibarlı mənbələr keçir: CLIENT_ORIGIN, öz saytının Origin-i (Host ilə eyni), Origin-siz (curl/server-server)', async () => {
    expect((await post('/api/orders/10/refund', { Origin: process.env.CLIENT_ORIGIN })).status).toBe(404);
    expect((await post('/api/orders/10/refund', { Origin: 'http://menu.example.az', Host: 'menu.example.az' })).status).toBe(404);
    expect((await post('/api/orders/10/refund')).status).toBe(404);
    expect((await post('/api/orders/10/refund', { 'Sec-Fetch-Site': 'same-origin' })).status).toBe(404);
  });

  it('təhlükəsiz metodlar (GET) bloklanmır; ödəniş provayderinin server-server callback-i istisnadır', async () => {
    const get = await request(app).get('/api/health').set('Origin', EVIL);
    expect(get.status).not.toBe(403);
    const cb = await request(app).post('/api/payments/epoint/callback').set('Origin', EVIL).type('form').send({ data: 'x', signature: 'y' });
    expect(cb.status).not.toBe(403); // imza səhvi 400-dür, CSRF 403 deyil
  });

  it('host başlığı saxtalaşdırılsa belə, başqa saytın Origin-i öz saytının Origin-i sayılmır', async () => {
    // hücumçunun brauzeri Host-u dəyişə bilmir; Host həmişə hədəf serverdir, Origin isə hücumçunun saytıdır
    const res = await post('/api/orders/10/refund', { Origin: EVIL, Host: 'menu.example.az' });
    expect(res.status).toBe(403);
  });
});
