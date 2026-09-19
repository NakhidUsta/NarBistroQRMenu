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
jest.mock('../src/repositories/orderRepository');
jest.mock('../src/services/auditService', () => ({ list: jest.fn(), log: jest.fn() }));

const orderRepository = require('../src/repositories/orderRepository');
const auditService = require('../src/services/auditService');
const { parsePage, sendPage } = require('../src/utils/pagination');
const app = require('../src/app');

const rows = (n, start = 100) => Array.from({ length: n }, (_, i) => ({ id: start - i }));
const owner = () => ({ Cookie: cookieFor('OWNER') });

describe('parsePage / sendPage', () => {
  it('defolt limit 200, before yoxdur; düzgün dəyərlər qəbul edilir', () => {
    expect(parsePage({})).toEqual({ limit: 200, before: undefined });
    expect(parsePage({ limit: '30', before: '55' })).toEqual({ limit: 30, before: 55 });
  });

  it.each([
    [{ limit: '0' }], [{ limit: '201' }], [{ limit: 'abc' }], [{ limit: '1.5' }],
    [{ before: '0' }], [{ before: '-3' }], [{ before: 'x' }], [{ before: '1 OR 1=1' }],
  ])('yanlış parametr %j rədd edilir (400)', (query) => {
    expect(() => parsePage(query)).toThrow(expect.objectContaining({ status: 400 }));
  });

  it('artıq sətir "daha var" deməkdir və qaytarılmır', () => {
    const res = { set: jest.fn() };
    expect(sendPage(res, [1, 2, 3], 2)).toEqual([1, 2]);
    expect(res.set).toHaveBeenLastCalledWith('X-Has-More', '1');
    expect(sendPage(res, [1, 2], 2)).toEqual([1, 2]);
    expect(res.set).toHaveBeenLastCalledWith('X-Has-More', '0');
  });
});

describe('GET /api/orders səhifələmə', () => {
  it('limit+1 sətir istəyir, limit qədər qaytarır və X-Has-More başlığı qoyur', async () => {
    orderRepository.findAll.mockResolvedValue(rows(31));
    const res = await request(app).get('/api/orders?limit=30').set(owner());
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(30);
    expect(res.headers['x-has-more']).toBe('1');
    expect(orderRepository.findAll).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ limit: 31, before: undefined }));
  });

  it('son səhifədə X-Has-More = 0; before kursoru repozitoriyaya ötürülür', async () => {
    orderRepository.findAll.mockResolvedValue(rows(10, 70));
    const res = await request(app).get('/api/orders?limit=30&before=71').set(owner());
    expect(res.body).toHaveLength(10);
    expect(res.headers['x-has-more']).toBe('0');
    expect(orderRepository.findAll).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ before: 71 }));
  });

  it('parametrsiz sorğu əvvəlki kimi işləyir (limit 200, massiv qaytarır)', async () => {
    orderRepository.findAll.mockResolvedValue(rows(3));
    const res = await request(app).get('/api/orders').set(owner());
    expect(Array.isArray(res.body)).toBe(true);
    expect(orderRepository.findAll).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ limit: 201 }));
  });

  it('yanlış limit/before 400 qaytarır', async () => {
    expect((await request(app).get('/api/orders?limit=9999').set(owner())).status).toBe(400);
    expect((await request(app).get('/api/orders?before=abc').set(owner())).status).toBe(400);
  });

  it('CORS başlığı X-Has-More-u brauzerə açır (cross-origin dev/prod)', async () => {
    orderRepository.findAll.mockResolvedValue([]);
    const res = await request(app).get('/api/orders').set({ ...owner(), Origin: 'http://localhost:5174' });
    expect(res.headers['access-control-expose-headers']).toContain('X-Has-More');
  });
});

describe('GET /api/audit-logs səhifələmə', () => {
  it('kursor və limit ötürülür, X-Has-More qoyulur', async () => {
    auditService.list.mockResolvedValue(rows(51));
    const res = await request(app).get('/api/audit-logs?limit=50&before=900&entity_type=products').set(owner());
    expect(res.body).toHaveLength(50);
    expect(res.headers['x-has-more']).toBe('1');
    expect(auditService.list).toHaveBeenCalledWith({ entity_type: 'products', limit: 51, before: 900 });
  });

  it('yanlış limit 400', async () => {
    expect((await request(app).get('/api/audit-logs?limit=0').set(owner())).status).toBe(400);
  });
});
