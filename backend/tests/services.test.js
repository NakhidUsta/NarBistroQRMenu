jest.mock('../src/config/db', () => {
  const actual = jest.requireActual('mssql');
  class Transaction {
    constructor() {
      Transaction.instances.push(this);
      this.begin = jest.fn().mockResolvedValue();
      this.commit = jest.fn().mockResolvedValue();
      this.rollback = jest.fn().mockResolvedValue();
    }
  }
  Transaction.instances = [];
  return { sql: { ...actual, Transaction }, poolPromise: Promise.resolve({}) };
});
jest.mock('../src/repositories/promoRepository');
jest.mock('../src/repositories/orderRepository');
jest.mock('../src/repositories/tableRepository');
jest.mock('../src/repositories/adminUserRepository');
jest.mock('../src/repositories/restaurantRepository');
jest.mock('../src/services/notificationService', () => ({ create: jest.fn().mockResolvedValue({}) }));
jest.mock('../src/sockets/emit', () => ({
  emitOrderCreated: jest.fn(), emitOrderStatusUpdated: jest.fn(), emitProductUpdated: jest.fn(),
  emitRestaurantUpdated: jest.fn(), emitTableUpdated: jest.fn(),
}));

const promoRepository = require('../src/repositories/promoRepository');
const orderRepository = require('../src/repositories/orderRepository');
const adminUserRepository = require('../src/repositories/adminUserRepository');
const { sql } = require('../src/config/db');
const promoService = require('../src/services/promoService');
const restaurantService = require('../src/services/restaurantService');
const staffService = require('../src/services/staffService');
const orderService = require('../src/services/orderService');

const promo = (over = {}) => ({
  id: 1, code: 'X', is_active: true, discount_type: 'PERCENT', discount_value: 10,
  min_order_amount: 20, starts_at: null, ends_at: null, usage_limit: null, usage_count: 0, ...over,
});

describe('promoService.validateAndCompute (endirim yalnız backend-də hesablanır)', () => {
  const run = (over, subtotal = 100) => {
    promoRepository.findByCodeTx.mockResolvedValue(over === null ? null : promo(over));
    return promoService.validateAndCompute({}, 'X', subtotal);
  };

  it('faiz endirimi', async () => {
    expect((await run({})).discount).toBe(10);
  });

  it('sabit endirim, məbləği aşmır', async () => {
    expect((await run({ discount_type: 'FIXED', discount_value: 500, min_order_amount: 0 }, 30)).discount).toBe(30);
  });

  it('kod yoxdur / deaktivdir', async () => {
    await expect(run(null)).rejects.toMatchObject({ status: 400 });
    await expect(run({ is_active: false })).rejects.toMatchObject({ status: 400 });
  });

  it('minimum sifariş məbləği', async () => {
    await expect(run({ min_order_amount: 50 }, 30)).rejects.toThrow(/minimum/);
  });

  it('müddəti bitib / başlamayıb', async () => {
    await expect(run({ ends_at: '2000-01-01' })).rejects.toThrow(/bitib/);
    await expect(run({ starts_at: '2999-01-01' })).rejects.toThrow(/başlamayıb/);
  });

  it('istifadə limiti', async () => {
    await expect(run({ usage_limit: 5, usage_count: 5 })).rejects.toThrow(/limiti/);
  });

  it('kəsr məbləğləri düzgün yuvarlaqlaşdırılır', async () => {
    expect((await run({ discount_value: 15, min_order_amount: 0 }, 9.99)).discount).toBe(1.5);
  });
});

describe('restaurantService.sanitizeTheme (CSS/HTML inyeksiyasına qarşı)', () => {
  const { sanitizeTheme } = restaurantService;

  it('etibarlı temanı saxlayır, naməlum açarları atır', () => {
    const out = JSON.parse(sanitizeTheme({ primary: '#112233', font: 'Inter', evil: '<script>' }));
    expect(out).toEqual({ primary: '#112233', font: 'Inter' });
  });

  it('HEX olmayan rəngi rədd edir', () => {
    expect(() => sanitizeTheme({ primary: 'red; background:url(x)' })).toThrow();
    expect(() => sanitizeTheme({ background: '#12' })).toThrow();
  });

  it('siyahıda olmayan fontu rədd edir', () => {
    expect(() => sanitizeTheme({ font: 'Comic Sans; }' })).toThrow();
  });

  it('boş dəyər null qaytarır, uzun mətn kəsilir', () => {
    expect(sanitizeTheme(null)).toBeNull();
    expect(JSON.parse(sanitizeTheme({ banner_text: 'x'.repeat(999) })).banner_text).toHaveLength(200);
  });
});

describe('staffService qaydaları', () => {
  beforeEach(() => jest.clearAllMocks());

  it('zəif şifrə rədd edilir', async () => {
    adminUserRepository.findByEmail.mockResolvedValue(null);
    await expect(staffService.create({ email: 'a@b.co', password: '123', role: 'WAITER' })).rejects.toThrow(/8 simvol/);
  });

  it('yanlış rol rədd edilir', async () => {
    await expect(staffService.create({ email: 'a@b.co', password: '12345678', role: 'GOD' })).rejects.toMatchObject({ status: 400 });
  });

  it('təkrar e-poçt 409', async () => {
    adminUserRepository.findByEmail.mockResolvedValue({ id: 3 });
    await expect(staffService.create({ email: 'a@b.co', password: '12345678', role: 'WAITER' })).rejects.toMatchObject({ status: 409 });
  });

  it('şifrə bcrypt ilə hash-lənir (açıq mətn saxlanmır)', async () => {
    adminUserRepository.findByEmail.mockResolvedValue(null);
    adminUserRepository.create.mockImplementation(async (u) => u);
    const created = await staffService.create({ email: 'a@b.co', password: '12345678', role: 'WAITER' });
    expect(created.password_hash).toMatch(/^\$2[aby]\$/);
    expect(created.password_hash).not.toContain('12345678');
  });

  it('öz hesabını silə bilməz', async () => {
    await expect(staffService.remove(1, 1)).rejects.toThrow(/Öz hesabınızı/);
  });

  it('son OWNER silinə və ya aşağı salına bilməz', async () => {
    adminUserRepository.findById.mockResolvedValue({ id: 2, role: 'OWNER' });
    adminUserRepository.countByRole.mockResolvedValue(1);
    await expect(staffService.remove(2, 1)).rejects.toThrow(/OWNER/);
    await expect(staffService.update(2, { role: 'WAITER' }, 1)).rejects.toThrow(/OWNER/);
  });
});

describe('orderService.createOrder', () => {
  const items = [{ product_id: 1, quantity: 2 }, { product_id: 2, quantity: 1 }];
  const base = { customer_name: 'Ali', phone: '+994501112233', items };

  beforeEach(() => {
    jest.clearAllMocks();
    sql.Transaction.instances.length = 0;
    orderRepository.insertOrder.mockImplementation(async (tx, o) => ({ id: 10, ...o }));
    orderRepository.findProductPrice.mockImplementation(async (tx, id) => ({
      id, price: id === 1 ? 24 : 9, is_available: true, track_inventory: false, stock_quantity: null,
    }));
  });

  it('yekun məbləği DB qiymətlərindən hesablayır və commit edir', async () => {
    const order = await orderService.createOrder(base);
    expect(order.subtotal).toBe(57);
    expect(order.total).toBe(57);
    expect(orderRepository.insertOrderItem).toHaveBeenCalledTimes(2);
    expect(orderRepository.insertStatusHistory).toHaveBeenCalledWith(expect.anything(), { order_id: 10, status: 'NEW' });
    expect(sql.Transaction.instances[0].commit).toHaveBeenCalled();
  });

  it('müştərinin göndərdiyi qiymətə etibar etmir', async () => {
    const order = await orderService.createOrder({ ...base, items: [{ product_id: 1, quantity: 1, price: 0.01 }] });
    expect(order.subtotal).toBe(24);
  });

  it('promo kodu tətbiq edir və istifadəni qeyd edir', async () => {
    promoRepository.findByCodeTx.mockResolvedValue(promo({ min_order_amount: 0 }));
    const order = await orderService.createOrder({ ...base, promo_code: ' x ' });
    expect(order.discount).toBe(5.7);
    expect(order.total).toBe(51.3);
    expect(promoRepository.insertUsageTx).toHaveBeenCalled();
    expect(promoRepository.incrementUsageTx).toHaveBeenCalled();
  });

  it('mövcud olmayan məhsulda rollback edir', async () => {
    orderRepository.findProductPrice.mockResolvedValueOnce({ id: 1, price: 24, is_available: false });
    await expect(orderService.createOrder(base)).rejects.toThrow(/mövcud deyil/);
    expect(sql.Transaction.instances[0].rollback).toHaveBeenCalled();
    expect(sql.Transaction.instances[0].commit).not.toHaveBeenCalled();
  });

  it('stok çatmadıqda sifarişi rədd edir və rollback edir', async () => {
    orderRepository.findProductPrice.mockResolvedValueOnce({ id: 1, price: 24, is_available: true, track_inventory: true, stock_quantity: 1 });
    orderRepository.decrementStockTx.mockResolvedValueOnce(null);
    await expect(orderService.createOrder(base)).rejects.toThrow(/stok/);
    expect(sql.Transaction.instances[0].rollback).toHaveBeenCalled();
    expect(orderRepository.insertOrder).not.toHaveBeenCalled();
  });

  it('yanlış promo kodda sifariş yaradılmır', async () => {
    promoRepository.findByCodeTx.mockResolvedValue(null);
    await expect(orderService.createOrder({ ...base, promo_code: 'YOX' })).rejects.toMatchObject({ status: 400 });
    expect(orderRepository.insertOrder).not.toHaveBeenCalled();
  });

  it('sifariş detalı yalnız düzgün token ilə açılır', async () => {
    orderRepository.findById.mockResolvedValue({ id: 5, access_token: 'secret', customer_name: 'Ali' });
    await expect(orderService.getOrder(5, { token: 'yanlis' })).rejects.toMatchObject({ status: 404 });
    const ok = await orderService.getOrder(5, { token: 'secret' });
    expect(ok.access_token).toBeUndefined();
    const admin = await orderService.getOrder(5, { isAdmin: true });
    expect(admin.customer_name).toBe('Ali');
  });
});
