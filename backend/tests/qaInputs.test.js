// QA dinamik problarından çıxan regresiyalar: giriş limitləri (500 əvəzinə 400), DB parametr xətaları, /health sızması
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
jest.mock('../src/utils/logger', () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn() }));
jest.mock('../src/services/systemAlertService', () => ({ reportRequestError: jest.fn() }));
jest.mock('../src/sockets/emit', () => ({ getSocketStats: jest.fn(() => ({ public_clients: 3, admin_clients: 1 })) }));
jest.mock('../src/services/orderService');

const orderService = require('../src/services/orderService');
const { validateCreateOrderBody, validateItems } = require('../src/validators/orderValidator');
const errorHandler = require('../src/middleware/errorHandler');
const app = require('../src/app');

const base = { customer_name: 'Əli', phone: '+994501112233', items: [{ product_id: 1, quantity: 2 }] };

describe('sifariş giriş hədləri (validator)', () => {
  it('normal sifariş keçir', () => {
    expect(validateCreateOrderBody(base)).toBeNull();
    expect(validateCreateOrderBody({ ...base, note: 'x'.repeat(300), customer_name: 'A'.repeat(120) })).toBeNull();
  });

  it('çox uzun ad/telefon/qeyd rədd edilir (DB-də 500 yox)', () => {
    expect(validateCreateOrderBody({ ...base, customer_name: 'A'.repeat(121) })).toMatch(/Ad ən çox 120/);
    expect(validateCreateOrderBody({ ...base, phone: '+' + '9'.repeat(40) })).toMatch(/Telefon ən çox 30/);
    expect(validateCreateOrderBody({ ...base, note: 'n'.repeat(301) })).toMatch(/Qeyd ən çox 300/);
  });

  it('sətir sayı ≤ 50, miqdar ≤ 99, ID SQL INT daxilində', () => {
    const many = Array.from({ length: 51 }, () => ({ product_id: 1, quantity: 1 }));
    expect(validateCreateOrderBody({ ...base, items: many })).toMatch(/ən çox 50/);
    expect(validateCreateOrderBody({ ...base, items: many.slice(0, 50) })).toBeNull();
    expect(validateCreateOrderBody({ ...base, items: [{ product_id: 1, quantity: 100 }] })).toMatch(/ən çox 99/);
    expect(validateCreateOrderBody({ ...base, items: [{ product_id: 1, quantity: 99 }] })).toBeNull();
    expect(validateCreateOrderBody({ ...base, items: [{ product_id: 2147483648, quantity: 1 }] })).toMatch(/düzgün product_id/);
    expect(validateCreateOrderBody({ ...base, items: [null] })).toMatch(/düzgün product_id/);
    expect(validateItems([{ product_id: 0, quantity: 1 }])).toMatch(/düzgün product_id/);
  });

  it('POST /api/orders və /api/orders/quote eyni hədləri tətbiq edir (400, servisə çatmır)', async () => {
    const many = Array.from({ length: 60 }, () => ({ product_id: 1, quantity: 1 }));
    expect((await request(app).post('/api/orders').send({ ...base, items: many })).status).toBe(400);
    expect((await request(app).post('/api/orders/quote').send({ items: many })).status).toBe(400);
    expect((await request(app).post('/api/orders/quote').send({ items: [{ product_id: 1, quantity: 1e9 }] })).status).toBe(400);
    expect(orderService.createOrder).not.toHaveBeenCalled();
    expect(orderService.quote).not.toHaveBeenCalled();
  });
});

describe('errorHandler: DB parametr xətaları 400, gözlənilməyənlər 500', () => {
  const run = (err) => {
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    errorHandler(err, { method: 'GET', originalUrl: '/x' }, res, () => {});
    return res;
  };

  it('EPARAM (INT aşımı) və 8152/2628 (mətn çox uzun) → 400', () => {
    const paramErr = Object.assign(new Error("Validation failed for parameter 'id'. Invalid number."), { code: 'EPARAM' });
    expect(run(paramErr).status).toHaveBeenCalledWith(400);
    for (const number of [8152, 2628]) {
      const truncErr = Object.assign(new Error('String or binary data would be truncated'), { code: 'EREQUEST', number });
      expect(run(truncErr).status).toHaveBeenCalledWith(400);
    }
  });

  it('NVarChar(N) parametrə çox uzun mətn (TDS "invalid data length") → 400, 500 deyil (canlıda /tables/<uzun-kod>/scan 500 verirdi)', () => {
    const tds = Object.assign(new Error('The incoming tabular data stream (TDS) remote procedure call (RPC) protocol stream is incorrect. Parameter 3 ("@code"): Data type 0xE7 has an invalid data length or metadata length.'), { code: 'EREQUEST' });
    const res = run(tds);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(JSON.stringify(res.json.mock.calls)).not.toMatch(/TDS|@code/);
  });

  it('digər DB xətaları (məs. deadlock) hələ də 500 və ümumi mesaj; daxili detal sızmır', () => {
    const res = run(Object.assign(new Error('Transaction was deadlocked SELECT * FROM secret'), { code: 'EREQUEST', number: 1205 }));
    expect(res.status).toHaveBeenCalledWith(500);
    expect(JSON.stringify(res.json.mock.calls)).not.toMatch(/deadlock|SELECT/);
  });
});

describe('/api/health sızması', () => {
  it('girişsiz və aşağı rol yalnız status/database görür (uptime, socket sayı yoxdur)', async () => {
    for (const cookie of [undefined, cookieFor('WAITER'), cookieFor('KITCHEN')]) {
      const req = request(app).get('/api/health');
      const res = await (cookie ? req.set('Cookie', cookie) : req);
      expect(res.status).toBe(200);
      expect(Object.keys(res.body).sort()).toEqual(['database', 'status']);
    }
  });

  it('OWNER/MANAGER ətraflı diaqnostikanı görür', async () => {
    const res = await request(app).get('/api/health').set('Cookie', cookieFor('OWNER'));
    expect(res.body.uptime_s).toEqual(expect.any(Number));
    expect(res.body.sockets).toEqual({ public_clients: 3, admin_clients: 1 });
  });
});
