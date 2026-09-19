const request = require('supertest');
const { cookieFor, fakePool } = require('./helpers');

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
jest.mock('../src/services/adminService', () => ({ getDashboard: jest.fn().mockResolvedValue({ ok: true }) }));

const app = require('../src/app');

describe('health', () => {
  it('DB cavab verəndə 200 qaytarır', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('naməlum endpoint 404 (JSON) qaytarır, stack trace göstərmir', async () => {
    const res = await request(app).get('/api/yoxdur');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Endpoint tapılmadı' });
  });

  it('təhlükəsizlik başlıqlarını təyin edir', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});

describe('autentifikasiya və rol icazələri', () => {
  it.each(['/api/orders', '/api/staff', '/api/audit-logs', '/api/admin/dashboard', '/api/promos', '/api/tables'])(
    'girişsiz %s -> 401',
    async (path) => {
      const res = await request(app).get(path);
      expect(res.status).toBe(401);
    },
  );

  it('KITCHEN rolu dashboard, promo, işçilər və bildirişlərə çıxış edə bilmir (403)', async () => {
    const cookie = cookieFor('KITCHEN');
    for (const path of ['/api/admin/dashboard', '/api/promos', '/api/staff', '/api/notifications', '/api/audit-logs']) {
      const res = await request(app).get(path).set('Cookie', cookie);
      expect(res.status).toBe(403);
    }
  });

  it('WAITER rolu işçi və audit səhifələrinə çıxış edə bilmir', async () => {
    const cookie = cookieFor('WAITER');
    expect((await request(app).get('/api/staff').set('Cookie', cookie)).status).toBe(403);
    expect((await request(app).get('/api/audit-logs').set('Cookie', cookie)).status).toBe(403);
  });

  it('MANAGER işçi idarəsinə çıxış edə bilmir, audit-ə edə bilir', async () => {
    const cookie = cookieFor('MANAGER');
    expect((await request(app).get('/api/staff').set('Cookie', cookie)).status).toBe(403);
    expect((await request(app).get('/api/audit-logs').set('Cookie', cookie)).status).toBe(200);
  });

  it('OWNER dashboard-a çıxış edə bilir', async () => {
    const res = await request(app).get('/api/admin/dashboard').set('Cookie', cookieFor('OWNER'));
    expect(res.status).toBe(200);
  });

  it('etibarsız token 401 qaytarır', async () => {
    const res = await request(app).get('/api/orders').set('Cookie', ['qrmenu_token=saxta']);
    expect(res.status).toBe(401);
  });

  it('köhnə token versiyası (şifrə dəyişib / bütün cihazlardan çıxış) 401 qaytarır', async () => {
    const res = await request(app).get('/api/orders').set('Cookie', cookieFor('OWNER', { tv: 5 }));
    expect(res.status).toBe(401);
  });

  it('DB-də silinmiş istifadəçinin tokeni 401 qaytarır', async () => {
    const res = await request(app).get('/api/orders').set('Cookie', cookieFor('OWNER', { id: 999 }));
    expect(res.status).toBe(401);
  });

  it('rol tokendən yox, DB-dən oxunur: token OWNER deyir, DB-də KITCHEN → 403', async () => {
    // id=4 DB-də KITCHEN-dir; saxta token isə role:OWNER iddia edir
    const jwt = require('jsonwebtoken');
    const token = jwt.sign({ id: 4, email: 'x', role: 'OWNER', restaurant_id: 1, tv: 0 }, process.env.JWT_SECRET);
    const res = await request(app).get('/api/staff').set('Cookie', [`qrmenu_token=${token}`]);
    expect(res.status).toBe(403);
  });

  it('şifrə dəyişmə və hamıdan çıxış giriş tələb edir', async () => {
    expect((await request(app).post('/api/auth/change-password').send({ current_password: 'a', new_password: 'b' })).status).toBe(401);
    expect((await request(app).post('/api/auth/logout-all')).status).toBe(401);
  });

  it('sifariş statusunu yalnız icazəli rol dəyişə bilər (müştəri -> 401)', async () => {
    const res = await request(app).put('/api/orders/1').send({ status: 'READY' });
    expect(res.status).toBe(401);
  });
});

describe('sifariş yaradılması — giriş yoxlaması (müştəri, girişsiz)', () => {
  const valid = { customer_name: 'Ali', phone: '+994501112233', items: [{ product_id: 1, quantity: 1 }] };

  it('ad tələb olunur', async () => {
    const res = await request(app).post('/api/orders').send({ ...valid, customer_name: '  ' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Müştəri adı/);
  });

  it('telefon düzgün olmalıdır', async () => {
    const res = await request(app).post('/api/orders').send({ ...valid, phone: 'abc' });
    expect(res.status).toBe(400);
  });

  it('boş məhsul siyahısı rədd edilir', async () => {
    const res = await request(app).post('/api/orders').send({ ...valid, items: [] });
    expect(res.status).toBe(400);
  });

  it('mənfi/kəsr miqdar rədd edilir', async () => {
    for (const quantity of [0, -2, 1.5]) {
      const res = await request(app).post('/api/orders').send({ ...valid, items: [{ product_id: 1, quantity }] });
      expect(res.status).toBe(400);
    }
  });

  it('sifariş detalını token olmadan oxumaq mümkün deyil (ID təxmini)', async () => {
    const res = await request(app).get('/api/orders/abc');
    expect(res.status).toBe(400);
  });
});

describe('sifariş siyahısı filtrləri və səbət quote', () => {
  it('yanlış status/tarix filtri 400', async () => {
    const cookie = cookieFor('WAITER');
    expect((await request(app).get('/api/orders?status=BAD').set('Cookie', cookie)).status).toBe(400);
    expect((await request(app).get('/api/orders?date=2026-13-x').set('Cookie', cookie)).status).toBe(400);
  });

  it('boş səbətin quote-u 400', async () => {
    expect((await request(app).post('/api/orders/quote').send({ items: [] })).status).toBe(400);
    expect((await request(app).post('/api/orders/quote').send({ items: [{ product_id: 1, quantity: 0 }] })).status).toBe(400);
  });

  it('restoran haqları: ƏDV 100%-dən böyük ola bilməz, mənfi çatdırılma rədd edilir', async () => {
    const cookie = cookieFor('OWNER');
    expect((await request(app).put('/api/restaurant').set('Cookie', cookie).send({ name: 'X', vat_percent: 150 })).status).toBe(400);
    expect((await request(app).put('/api/restaurant').set('Cookie', cookie).send({ name: 'X', delivery_fee: -1 })).status).toBe(400);
  });

  it('bildiriş silmə yalnız OWNER/MANAGER/WAITER üçün (KITCHEN -> 403)', async () => {
    expect((await request(app).delete('/api/notifications/1').set('Cookie', cookieFor('KITCHEN'))).status).toBe(403);
    expect((await request(app).delete('/api/notifications/1')).status).toBe(401);
  });
});

describe('admin əməliyyatlarının validasiyası', () => {
  it('kateqoriya slug-ı yalnız kiçik hərf/rəqəm/tire ola bilər', async () => {
    const res = await request(app).post('/api/categories').set('Cookie', cookieFor('OWNER')).send({ name: 'X', slug: 'Bad Slug!' });
    expect(res.status).toBe(400);
  });

  it('məhsul qiyməti mənfi ola bilməz', async () => {
    const res = await request(app).post('/api/products').set('Cookie', cookieFor('OWNER')).send({ name: 'X', price: -1, category_id: 1 });
    expect(res.status).toBe(400);
  });

  it('promo faiz 100-dən böyük ola bilməz', async () => {
    const res = await request(app).post('/api/promos').set('Cookie', cookieFor('OWNER')).send({ code: 'BAD', discount_type: 'PERCENT', discount_value: 150 });
    expect(res.status).toBe(400);
  });

  it('WAITER məhsul yarada bilməz (403)', async () => {
    const res = await request(app).post('/api/products').set('Cookie', cookieFor('WAITER')).send({ name: 'X', price: 1, category_id: 1 });
    expect(res.status).toBe(403);
  });

  it('masa skanı token tələb edir', async () => {
    const res = await request(app).post('/api/tables/table_001/scan').send({});
    expect(res.status).toBe(400);
  });
});
