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
jest.mock('../src/repositories/notificationRepository');
jest.mock('../src/sockets/emit', () => ({
  emitNotificationCreated: jest.fn(),
  emitNotificationUpdated: jest.fn(),
  emitProductUpdated: jest.fn(),
}));

const notificationRepository = require('../src/repositories/notificationRepository');
const { emitNotificationCreated, emitNotificationUpdated } = require('../src/sockets/emit');
const auditService = require('../src/services/auditService');
const notificationService = require('../src/services/notificationService');
const systemAlertService = require('../src/services/systemAlertService');
const app = require('../src/app');

const call = (over = {}) => ({ id: 5, type: 'call_waiter', status: 'OPEN', is_read: false, title: 'Masa 5 — Ofisiant çağırılır', ...over });

beforeEach(() => {
  jest.clearAllMocks();
  systemAlertService.resetThrottle();
  notificationRepository.findById.mockResolvedValue(call());
  notificationRepository.markRead.mockImplementation(async (id) => call({ id, is_read: true }));
  notificationRepository.setStatus.mockImplementation(async (id, status, admin) => call({ id, status, handled_by: admin, is_read: true, handled_by_email: 'w@x.az' }));
  notificationRepository.findAll.mockResolvedValue([]);
});

describe('PATCH /api/notifications/:id/status (Call Waiter / Request Bill)', () => {
  const patch = (role, status, id = 5) => request(app).patch(`/api/notifications/${id}/status`).set('Cookie', cookieFor(role)).send({ status });

  it('ofisiant [Qəbul et] edir: status ACCEPTED, kim işlədiyi yazılır, digər adminlərə yayımlanır, audit loga düşür', async () => {
    const res = await patch('WAITER', 'ACCEPTED');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ACCEPTED', handled_by_email: 'w@x.az' });
    expect(notificationRepository.setStatus).toHaveBeenCalledWith(5, 'ACCEPTED', 3);
    expect(emitNotificationUpdated).toHaveBeenCalledWith(expect.objectContaining({ id: 5, status: 'ACCEPTED' }));
    expect(auditService.log).toHaveBeenCalledWith(expect.anything(), 'notification.status', 'notifications', 5, { status: 'OPEN' }, { status: 'ACCEPTED' });
  });

  it('[Həll edildi]: ACCEPTED → RESOLVED və OPEN → RESOLVED icazəlidir', async () => {
    notificationRepository.findById.mockResolvedValue(call({ status: 'ACCEPTED' }));
    expect((await patch('MANAGER', 'RESOLVED')).status).toBe(200);
    notificationRepository.findById.mockResolvedValue(call({ status: 'OPEN' }));
    expect((await patch('OWNER', 'RESOLVED')).status).toBe(200);
  });

  it('həll olunmuş sorğu geri açılmır (409), təkrar qəbul da olmur', async () => {
    notificationRepository.findById.mockResolvedValue(call({ status: 'RESOLVED' }));
    const res = await patch('WAITER', 'ACCEPTED');
    expect(res.status).toBe(409);
    expect(notificationRepository.setStatus).not.toHaveBeenCalled();
    notificationRepository.findById.mockResolvedValue(call({ status: 'ACCEPTED' }));
    expect((await patch('WAITER', 'ACCEPTED')).status).toBe(409);
  });

  it('yalnız call_waiter/request_bill üçün: sifariş bildirişinin statusu dəyişmir (400)', async () => {
    notificationRepository.findById.mockResolvedValue(call({ type: 'order_created' }));
    expect((await patch('WAITER', 'ACCEPTED')).status).toBe(400);
  });

  it('yanlış status 400, mətbəx 403, giriş yoxdursa 401, mövcud olmayan bildiriş 404', async () => {
    expect((await patch('WAITER', 'OPEN')).status).toBe(400);
    expect((await patch('WAITER', 'DONE')).status).toBe(400);
    expect((await patch('KITCHEN', 'ACCEPTED')).status).toBe(403);
    expect((await request(app).patch('/api/notifications/5/status').send({ status: 'ACCEPTED' })).status).toBe(401);
    notificationRepository.findById.mockResolvedValue(null);
    expect((await patch('WAITER', 'ACCEPTED', 99)).status).toBe(404);
  });
});

describe('notificationService', () => {
  it('createOnce: masada həll olunmamış eyni sorğu varsa ikinci bildiriş yaratmır', async () => {
    notificationRepository.findUnresolved.mockResolvedValue(call({ status: 'ACCEPTED' }));
    const result = await notificationService.createOnce({ type: 'call_waiter', title: 'x', entity_type: 'table', entity_id: 5 });
    expect(result.id).toBe(5);
    expect(notificationRepository.create).not.toHaveBeenCalled();
    expect(emitNotificationCreated).not.toHaveBeenCalled();
  });

  it('createOnce: açıq sorğu yoxdursa yaradır və yayımlayır', async () => {
    notificationRepository.findUnresolved.mockResolvedValue(null);
    notificationRepository.create.mockResolvedValue(call({ id: 9 }));
    await notificationService.createOnce({ type: 'call_waiter', title: 'x', entity_type: 'table', entity_id: 5 });
    expect(notificationRepository.create).toHaveBeenCalledTimes(1);
    expect(emitNotificationCreated).toHaveBeenCalledWith(expect.objectContaining({ id: 9 }));
  });

  it('ofisiant sistem xətası bildirişlərini görmür, sahib/menecer görür', async () => {
    await notificationService.list({ role: 'WAITER' });
    expect(notificationRepository.findAll).toHaveBeenLastCalledWith(expect.objectContaining({ excludeTypes: ['system_error'] }));
    await notificationService.list({ role: 'OWNER' });
    expect(notificationRepository.findAll).toHaveBeenLastCalledWith(expect.objectContaining({ excludeTypes: [] }));
  });
});

describe('systemAlertService (sistem xəbərdarlıqları)', () => {
  it('eyni xəbərdarlıq 10 dəqiqə ərzində təkrar göndərilmir', async () => {
    notificationRepository.create.mockResolvedValue({ id: 1, type: 'system_error' });
    await systemAlertService.report('k', 'Sistem xətası', 'a');
    await systemAlertService.report('k', 'Sistem xətası', 'a');
    await systemAlertService.report('other', 'Sistem xətası', 'b');
    expect(notificationRepository.create).toHaveBeenCalledTimes(2);
  });

  it('DB çökübsə bildiriş yazıla bilmir — canlı adminlərə müvəqqəti (ephemeral) xəbərdarlıq göndərilir', async () => {
    notificationRepository.create.mockRejectedValue(new Error('db down'));
    const result = await systemAlertService.report('db', 'Verilənlər bazası əlçatan deyil', 'x');
    expect(result).toMatchObject({ type: 'system_error', ephemeral: true });
    expect(result.id).toBeLessThan(0);
    expect(emitNotificationCreated).toHaveBeenCalledWith(expect.objectContaining({ ephemeral: true }));
  });

  it('mesaj 480 simvola kəsilir (DB sütun limiti)', async () => {
    notificationRepository.create.mockImplementation(async (n) => ({ id: 1, ...n }));
    const result = await systemAlertService.report('long', 'T', 'x'.repeat(2000));
    expect(result.body).toHaveLength(480);
  });
});

describe('errorHandler', () => {
  it('yanlış JSON gövdəsi 400 qaytarır (500 yox) və sistem xəbərdarlığı yaratmır', async () => {
    const res = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{"email": bozuk');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Yanlış sorğu');
    expect(notificationRepository.create).not.toHaveBeenCalled();
  });

  it('gözlənilməz xəta: istifadəçiyə stack trace verilmir, sahib/menecerə xəbərdarlıq gedir', async () => {
    notificationRepository.findAll.mockRejectedValue(new Error('SQL: Invalid object name secret_table'));
    notificationRepository.create.mockResolvedValue({ id: 3, type: 'system_error' });
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const res = await request(app).get('/api/notifications').set('Cookie', cookieFor('OWNER'));
    spy.mockRestore();
    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).not.toMatch(/secret_table|stack|at /);
    await new Promise((r) => setImmediate(r));
    expect(notificationRepository.create).toHaveBeenCalledWith(expect.objectContaining({ type: 'system_error', title: 'Sistem xətası' }));
  });
});

describe('GET /api/notifications səhifələmə', () => {
  const rows = (n, start = 100) => Array.from({ length: n }, (_, i) => ({ id: start - i, type: 'order_created' }));

  it('limit+1 sətir istəyir, limit qədər qaytarır, X-Has-More və kursor (before) işləyir', async () => {
    notificationRepository.findAll.mockResolvedValue(rows(51));
    const res = await request(app).get('/api/notifications?limit=50&before=90').set('Cookie', cookieFor('WAITER'));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(50);
    expect(res.headers['x-has-more']).toBe('1');
    expect(notificationRepository.findAll).toHaveBeenLastCalledWith(expect.objectContaining({ limit: 51, before: 90, excludeTypes: ['system_error'] }));
  });

  it('parametrsiz sorğu əvvəlki kimi massiv qaytarır; yanlış limit 400', async () => {
    notificationRepository.findAll.mockResolvedValue(rows(3));
    const ok = await request(app).get('/api/notifications').set('Cookie', cookieFor('OWNER'));
    expect(Array.isArray(ok.body)).toBe(true);
    expect(ok.headers['x-has-more']).toBe('0');
    expect((await request(app).get('/api/notifications?limit=0').set('Cookie', cookieFor('OWNER'))).status).toBe(400);
  });
});
