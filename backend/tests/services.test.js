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
jest.mock('../src/repositories/reviewRepository');
jest.mock('../src/repositories/insightRepository');
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
const pricingService = require('../src/services/pricingService');
const restaurantRepository = require('../src/repositories/restaurantRepository');
const tableRepository = require('../src/repositories/tableRepository');

describe('CSV ixracı', () => {
  const insightService = require('../src/services/insightService');
  const insightRepository = require('../src/repositories/insightRepository');

  it('formula inyeksiyasını neytrallaşdırır, telefon nömrəsinə toxunmur', () => {
    expect(insightService.csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(insightService.csvCell('@SUM(A1)')).toBe(`"'@SUM(A1)"`);
    expect(insightService.csvCell('+cmd|calc')).toBe(`"'+cmd|calc"`);
    expect(insightService.csvCell('+994 50 111 22 33')).toBe('"+994 50 111 22 33"');
    expect(insightService.csvCell(-5)).toBe('"-5"');
    expect(insightService.csvCell(null)).toBe('');
  });

  it('BOM və başlıq sətri ilə CSV qurur, dırnaq/vergülü qoruyur', async () => {
    insightRepository.exportProductSales.mockResolvedValue([{ id: 1, name: 'Ət, "şef"', category: 'Əsas', quantity: 2, revenue: 48 }]);
    const csv = await insightService.productsCsv({ from: '2026-09-01', to: '2026-09-30' });
    expect(csv.startsWith('﻿"ID","Məhsul"')).toBe(true);
    expect(csv).toContain('"Ət, ""şef"""');
  });

  it('tarix aralığı yanlışdırsa 400', async () => {
    await expect(insightService.ordersCsv({ from: '2026-09-30', to: '2026-09-01' })).rejects.toMatchObject({ status: 400 });
    await expect(insightService.ordersCsv({})).rejects.toMatchObject({ status: 400 });
  });
});

describe('reviewService', () => {
  const reviewService = require('../src/services/reviewService');
  const reviewRepository = require('../src/repositories/reviewRepository');

  beforeEach(() => {
    jest.clearAllMocks();
    reviewRepository.findByOrder.mockResolvedValue(null);
    reviewRepository.create.mockImplementation(async (r) => r);
    orderRepository.findById.mockResolvedValue({ id: 5, access_token: 'tok', status: 'DELIVERED', customer_name: 'Ali' });
  });

  it('düzgün token və hazır sifarişlə rəy yaradılır (təsdiqsiz)', async () => {
    const r = await reviewService.createForOrder(5, 'tok', { rating: 5, comment: '  əla  ' });
    expect(r).toMatchObject({ order_id: 5, rating: 5, comment: 'əla', customer_name: 'Ali' });
  });

  it('yanlış token, yanlış reytinq, hələ hazır olmayan və təkrar rəy rədd edilir', async () => {
    await expect(reviewService.createForOrder(5, 'yanlis', { rating: 5 })).rejects.toMatchObject({ status: 404 });
    await expect(reviewService.createForOrder(5, 'tok', { rating: 6 })).rejects.toMatchObject({ status: 400 });
    await expect(reviewService.createForOrder(5, 'tok', { rating: 2.5 })).rejects.toMatchObject({ status: 400 });
    orderRepository.findById.mockResolvedValue({ id: 5, access_token: 'tok', status: 'NEW' });
    await expect(reviewService.createForOrder(5, 'tok', { rating: 5 })).rejects.toMatchObject({ status: 400 });
    orderRepository.findById.mockResolvedValue({ id: 5, access_token: 'tok', status: 'DELIVERED' });
    reviewRepository.findByOrder.mockResolvedValue({ id: 1 });
    await expect(reviewService.createForOrder(5, 'tok', { rating: 5 })).rejects.toMatchObject({ status: 409 });
  });
});

describe('pricingService.compute (bütün pul hesablaması backend-də)', () => {
  it('haqsız hal: yalnız ara cəmi', () => {
    expect(pricingService.compute({ subtotal: 50 })).toEqual({ subtotal: 50, discount: 0, service_fee: 0, vat: 0, delivery_fee: 0, total: 50 });
  });

  it('servis haqqı endirimli baza üzərindən, ƏDV isə baza+servis üzərindən', () => {
    const r = pricingService.compute({ subtotal: 100, discount: 10, serviceFeePercent: 10, vatPercent: 18 });
    expect(r).toMatchObject({ service_fee: 9, vat: 17.82, total: 116.82 });
  });

  it('çatdırılma haqqı yalnız takeaway-də tətbiq olunur', () => {
    expect(pricingService.compute({ subtotal: 20, deliveryFee: 3, isTakeaway: true }).total).toBe(23);
    expect(pricingService.compute({ subtotal: 20, deliveryFee: 3, isTakeaway: false }).total).toBe(20);
  });

  it('endirim ara cəmi aşa bilməz, kəsr yuvarlaqlaşdırılır', () => {
    expect(pricingService.compute({ subtotal: 5, discount: 99 }).total).toBe(0);
    expect(pricingService.compute({ subtotal: 0.1 + 0.2, vatPercent: 18 }).total).toBe(0.35);
  });
});

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

  it('Roman serif (Times New Roman) icazəli şriftdir', () => {
    expect(JSON.parse(sanitizeTheme({ font: 'Times New Roman' })).font).toBe('Times New Roman');
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

  it('ƏDV/servis/çatdırılma haqları sifarişə yazılır (masasız = takeaway)', async () => {
    restaurantRepository.find.mockResolvedValue({ vat_percent: 18, service_fee_percent: 10, delivery_fee: 3, currency: 'AZN' });
    const order = await orderService.createOrder(base);
    expect(order).toMatchObject({ subtotal: 57, service_fee: 5.7, vat: 11.29, delivery_fee: 3, total: 76.99 });
    restaurantRepository.find.mockResolvedValue(undefined);
  });

  it('masa ilə sifarişdə çatdırılma haqqı yoxdur', async () => {
    restaurantRepository.find.mockResolvedValue({ delivery_fee: 3 });
    tableRepository.findByCode.mockResolvedValue({ id: 1, code: 't1', label: 'Masa 1', is_active: true });
    const order = await orderService.createOrder({ ...base, table_code: 't1' });
    expect(order.delivery_fee).toBe(0);
    expect(order.total).toBe(57);
    restaurantRepository.find.mockResolvedValue(undefined);
  });

  it('təkrarlanan məhsul sətirləri birləşdirilir', async () => {
    await orderService.createOrder({ ...base, items: [{ product_id: 1, quantity: 1 }, { product_id: 1, quantity: 2 }] });
    expect(orderRepository.insertOrderItem).toHaveBeenCalledTimes(1);
    expect(orderRepository.insertOrderItem).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ product_id: 1, quantity: 3 }));
  });

  it('quote: sifariş yaratmadan cari qiymətlərlə yekunu qaytarır, promo xətasını 400 atmadan bildirir', async () => {
    promoRepository.findByCodeTx.mockResolvedValue(null);
    const q = await orderService.quote({ items, promo_code: 'YOX' });
    expect(q.total).toBe(57);
    expect(q.promo_error).toMatch(/Promo kod/);
    expect(orderRepository.insertOrder).not.toHaveBeenCalled();
  });

  it('quote: mövcud olmayan məhsul yekuna daxil edilmir və available=false işarələnir', async () => {
    orderRepository.findProductPrice.mockImplementation(async (tx, id) => ({ id, price: 10, is_available: id !== 2, track_inventory: false }));
    const q = await orderService.quote({ items });
    expect(q.total).toBe(20);
    expect(q.items.find((i) => i.product_id === 2).available).toBe(false);
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

describe('orderService.createOrder — idempotency və qiymət dəyişikliyi', () => {
  const items = [{ product_id: 1, quantity: 2 }, { product_id: 2, quantity: 1 }];
  const CID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
  const base = { customer_name: 'Ali', phone: '+994501112233', items };

  beforeEach(() => {
    jest.clearAllMocks();
    sql.Transaction.instances.length = 0;
    restaurantRepository.find.mockResolvedValue(undefined);
    orderRepository.findIdByClientRequestId.mockResolvedValue(null);
    orderRepository.insertOrder.mockImplementation(async (tx, o) => ({ id: 10, ...o }));
    orderRepository.findProductPrice.mockImplementation(async (tx, id) => ({
      id, price: id === 1 ? 24 : 9, is_available: true, track_inventory: false, stock_quantity: null,
    }));
  });

  it('client_request_id sifarişlə birlikdə saxlanılır', async () => {
    await orderService.createOrder({ ...base, client_request_id: CID });
    expect(orderRepository.insertOrder).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ client_request_id: CID }));
  });

  it('eyni ID ilə təkrar sorğu ikinci sifariş yaratmır, mövcudu qaytarır (replayed)', async () => {
    orderRepository.findIdByClientRequestId.mockResolvedValue({ id: 77, phone: base.phone });
    orderRepository.findById.mockResolvedValue({ id: 77, access_token: 'tok', total: 57 });
    const order = await orderService.createOrder({ ...base, client_request_id: CID });
    expect(order).toMatchObject({ id: 77, access_token: 'tok', replayed: true });
    expect(orderRepository.insertOrder).not.toHaveBeenCalled();
    expect(sql.Transaction.instances).toHaveLength(0);
  });

  it('başqa telefonla eyni ID sifariş tokenini sızdırmır (409)', async () => {
    orderRepository.findIdByClientRequestId.mockResolvedValue({ id: 77, phone: '+994559998877' });
    await expect(orderService.createOrder({ ...base, client_request_id: CID })).rejects.toMatchObject({ status: 409 });
    expect(orderRepository.findById).not.toHaveBeenCalled();
  });

  it('eyni anda gələn iki sorğu: unikal indeks pozuntusunda mövcud sifariş qaytarılır', async () => {
    orderRepository.findIdByClientRequestId
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 88, phone: base.phone });
    orderRepository.insertOrder.mockRejectedValueOnce(Object.assign(new Error('dup'), { number: 2601 }));
    orderRepository.findById.mockResolvedValue({ id: 88, access_token: 'tok2' });
    const order = await orderService.createOrder({ ...base, client_request_id: CID });
    expect(order).toMatchObject({ id: 88, replayed: true });
    expect(sql.Transaction.instances[0].rollback).toHaveBeenCalled();
  });

  it('gözlənilən məbləğ cari məbləğə bərabərdirsə sifariş yaranır', async () => {
    const order = await orderService.createOrder({ ...base, expected_total: 57 });
    expect(order.total).toBe(57);
  });

  it('qiymət dəyişibsə 409 PRICE_CHANGED verir, sifariş yaranmır və tranzaksiya geri qaytarılır', async () => {
    const err = await orderService.createOrder({ ...base, expected_total: 50 }).catch((e) => e);
    expect(err).toMatchObject({ status: 409, details: { code: 'PRICE_CHANGED', previous_total: 50, total: 57 } });
    expect(orderRepository.insertOrder).not.toHaveBeenCalled();
    expect(sql.Transaction.instances[0].rollback).toHaveBeenCalled();
    expect(sql.Transaction.instances[0].commit).not.toHaveBeenCalled();
  });

  it('expected_total verilməyibsə (köhnə klient) yoxlama aparılmır', async () => {
    await expect(orderService.createOrder(base)).resolves.toMatchObject({ total: 57 });
  });
});

describe('orderService — stok bildirişləri', () => {
  const notificationService = require('../src/services/notificationService');
  const base = { customer_name: 'Ali', phone: '+994501112233' };

  beforeEach(() => {
    jest.clearAllMocks();
    notificationService.create.mockResolvedValue({});
    restaurantRepository.find.mockResolvedValue(undefined);
    orderRepository.findIdByClientRequestId.mockResolvedValue(null);
    orderRepository.insertOrder.mockImplementation(async (tx, o) => ({ id: 10, ...o }));
    orderRepository.findProductPrice.mockResolvedValue({ id: 1, price: 10, is_available: true, track_inventory: true, stock_quantity: 10 });
  });

  const order = (qty, remaining) => {
    orderRepository.decrementStockTx.mockResolvedValue({ id: 1, name: 'Pasta', stock_quantity: remaining });
    return orderService.createOrder({ ...base, items: [{ product_id: 1, quantity: qty }] });
  };
  const types = () => notificationService.create.mock.calls.map(([n]) => n.type);

  it('stok 0-a düşəndə out_of_stock bildirişi yaranır', async () => {
    await order(3, 0);
    expect(types()).toEqual(['order_created', 'out_of_stock']);
    expect(notificationService.create).toHaveBeenLastCalledWith(expect.objectContaining({ title: 'Məhsul bitib: Pasta', entity_type: 'product', entity_id: 1 }));
  });

  it('stok həddi (5) ilk dəfə keçiləndə low_stock bildirişi yaranır', async () => {
    await order(2, 4); // əvvəl 6 idi
    expect(types()).toEqual(['order_created', 'low_stock']);
  });

  it('artıq hədd altında olan stokda təkrar low_stock bildirişi yaranmır', async () => {
    await order(1, 3); // əvvəl 4 idi
    expect(types()).toEqual(['order_created']);
  });

  it('kifayət qədər stok varsa yalnız sifariş bildirişi', async () => {
    await order(1, 9);
    expect(types()).toEqual(['order_created']);
  });

  it('bildiriş yaradıla bilməsə sifariş yenə də uğurlu qayıdır (artıq commit olunub)', async () => {
    notificationService.create.mockRejectedValue(new Error('notif db xətası'));
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(order(1, 9)).resolves.toMatchObject({ id: 10 });
    spy.mockRestore();
  });
});

describe('orderService.hasAccess (socket otağı üçün token yoxlaması)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('düzgün token qəbul edilir, yanlış/boş/uzunluğu fərqli token rədd edilir', async () => {
    orderRepository.findAccessToken.mockResolvedValue('a1b2c3d4e5f60718293a4b5c6d7e8f90');
    expect(await orderService.hasAccess(5, 'a1b2c3d4e5f60718293a4b5c6d7e8f90')).toBe(true);
    expect(await orderService.hasAccess(5, 'a1b2c3d4e5f60718293a4b5c6d7e8f91')).toBe(false);
    expect(await orderService.hasAccess(5, 'qisa')).toBe(false);
    expect(await orderService.hasAccess(5, '')).toBe(false);
    expect(await orderService.hasAccess(5, undefined)).toBe(false);
    expect(await orderService.hasAccess(5, { $ne: 1 })).toBe(false);
  });

  it('mövcud olmayan sifariş üçün həmişə rədd', async () => {
    orderRepository.findAccessToken.mockResolvedValue(null);
    expect(await orderService.hasAccess(999, 'x'.repeat(32))).toBe(false);
  });
});

describe('restaurantService: şəkil linkləri (loqo/favicon)', () => {
  const restaurantService = require('../src/services/restaurantService');

  beforeEach(() => {
    jest.clearAllMocks();
    restaurantRepository.update.mockImplementation(async (id, b) => ({ id, ...b }));
  });

  it('düzgün /uploads və https linkləri qəbul edilir, boş dəyər icazəlidir', async () => {
    await expect(restaurantService.updateRestaurant({ name: 'R', logo_url: '/uploads/m-1-aaaaaaaa.jpg', favicon_url: 'https://cdn.x/f.png' })).resolves.toBeDefined();
    await expect(restaurantService.updateRestaurant({ name: 'R', logo_url: '', favicon_url: null })).resolves.toBeDefined();
  });

  it.each(['javascript:alert(1)', 'data:image/svg+xml,<svg onload=alert(1)>', '/uploads/../secret', 'x'.repeat(501)])('favicon %s rədd edilir (400)', async (bad) => {
    await expect(restaurantService.updateRestaurant({ name: 'R', favicon_url: bad })).rejects.toMatchObject({ status: 400 });
    expect(restaurantRepository.update).not.toHaveBeenCalled();
  });
});
