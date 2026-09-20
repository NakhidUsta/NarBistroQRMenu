const request = require('supertest');
const crypto = require('crypto');
const { cookieFor } = require('./helpers');

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
jest.mock('../src/repositories/adminUserRepository', () => {
  const { authStateFor } = require('./helpers');
  return { findAuthState: jest.fn(async (id) => authStateFor(id)) };
});
jest.mock('../src/services/auditService', () => ({ list: jest.fn().mockResolvedValue([]), log: jest.fn() }));
jest.mock('../src/repositories/orderRepository');
jest.mock('../src/repositories/paymentRepository');
jest.mock('../src/repositories/tableRepository');
jest.mock('../src/repositories/restaurantRepository');
jest.mock('../src/repositories/promoRepository');
jest.mock('../src/services/notificationService', () => ({ create: jest.fn().mockResolvedValue({}) }));
jest.mock('../src/services/systemAlertService', () => ({ report: jest.fn().mockResolvedValue({}), startMonitor: jest.fn() }));
jest.mock('../src/sockets/emit', () => ({
  emitOrderCreated: jest.fn(), emitOrderStatusUpdated: jest.fn(), emitProductUpdated: jest.fn(),
  emitRestaurantUpdated: jest.fn(), emitTableUpdated: jest.fn(), getSocketStats: jest.fn(),
}));

const { sql } = require('../src/config/db');
const orderRepository = require('../src/repositories/orderRepository');
const paymentRepository = require('../src/repositories/paymentRepository');
const tableRepository = require('../src/repositories/tableRepository');
const restaurantRepository = require('../src/repositories/restaurantRepository');
const notificationService = require('../src/services/notificationService');
const systemAlertService = require('../src/services/systemAlertService');
const { emitOrderCreated, emitOrderStatusUpdated } = require('../src/sockets/emit');
const epoint = require('../src/services/payments/epoint');
const testProvider = require('../src/services/payments/testProvider');
const orderService = require('../src/services/orderService');
const paymentService = require('../src/services/paymentService');
const restaurantService = require('../src/services/restaurantService');
const app = require('../src/app');

const PRIVATE = 'priv-key-123';
const setEnv = (provider) => {
  process.env.PAYMENT_PROVIDER = provider;
  process.env.EPOINT_PUBLIC_KEY = 'i000000001';
  process.env.EPOINT_PRIVATE_KEY = PRIVATE;
  process.env.PUBLIC_URL = 'https://menu.example.az';
};
const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64');
const signed = (obj) => {
  const data = b64(obj);
  return { data, signature: epoint.sign(data, PRIVATE) };
};

const restaurant = (over = {}) => ({ id: 1, currency: 'AZN', vat_percent: 0, service_fee_percent: 0, delivery_fee: 0, pay_cash: true, pay_card_pos: true, pay_online: true, ...over });
const order = (over = {}) => ({ id: 10, status: 'NEW', total: 57, currency: 'AZN', payment_method: 'ONLINE', payment_status: 'PENDING', access_token: 'tok-1234567890abcdef', table_id: null, items: [{ product_id: 1, quantity: 2 }], ...over });
const payment = (over = {}) => ({ id: 5, order_id: 10, provider: 'epoint', method: 'ONLINE', status: 'PENDING', amount: 57, currency: 'AZN', provider_order_id: 'o10-abc', ...over });

beforeEach(() => {
  jest.clearAllMocks();
  sql.Transaction.instances.length = 0;
  setEnv('epoint');
  process.env.NODE_ENV = 'test';
  restaurantRepository.find.mockResolvedValue(restaurant());
  orderRepository.findById.mockResolvedValue(order());
  orderRepository.setPaymentTx.mockImplementation(async (tx, id, p) => order({ id, ...p, payment_status: p.payment_status, paid_amount: p.paid_amount }));
  orderRepository.findAccessToken.mockResolvedValue('tok-1234567890abcdef');
  paymentRepository.findByProviderOrderId.mockResolvedValue(payment());
  paymentRepository.findByProviderOrderIdForUpdate.mockResolvedValue(payment());
  paymentRepository.create.mockImplementation(async (db, p) => ({ id: 5, ...p }));
  paymentRepository.update.mockResolvedValue({});
});

describe('Epoint adapteri: imza və təhlükəsizlik', () => {
  it('callback imzası düzgündürsə qəbul edilir və status xəritələnir', () => {
    const parsed = epoint.parseCallback(signed({ order_id: 'o10-abc', status: 'success', transaction: 'te1', amount: 57, card_mask: '415432******1234' }));
    expect(parsed.valid).toBe(true);
    expect(parsed.result).toMatchObject({ providerOrderId: 'o10-abc', status: 'success', transaction: 'te1', amount: 57, cardMask: '415432******1234' });
    expect(epoint.parseCallback(signed({ order_id: 'x', status: 'error' })).result.status).toBe('failed');
    expect(epoint.parseCallback(signed({ order_id: 'x', status: 'returned' })).result.status).toBe('refunded');
    expect(epoint.parseCallback(signed({ order_id: 'x', status: 'new' })).result.status).toBe('pending');
  });

  it('dəyişdirilmiş məlumat və ya yanlış imza rədd edilir', () => {
    const ok = signed({ order_id: 'o10-abc', status: 'error', amount: 57 });
    const tampered = b64({ order_id: 'o10-abc', status: 'success', amount: 0.01 });
    expect(epoint.parseCallback({ data: tampered, signature: ok.signature }).valid).toBe(false);
    expect(epoint.parseCallback({ data: ok.data, signature: 'yalan' }).valid).toBe(false);
    expect(epoint.parseCallback({ data: ok.data }).valid).toBe(false);
    // başqa açarla imzalanmış
    const forged = b64({ order_id: 'o10-abc', status: 'success' });
    expect(epoint.parseCallback({ data: forged, signature: epoint.sign(forged, 'basqa-acar') }).valid).toBe(false);
  });

  it('açarlar yoxdursa callback heç vaxt etibarlı sayılmır', () => {
    delete process.env.EPOINT_PRIVATE_KEY;
    expect(epoint.parseCallback({ data: b64({}), signature: epoint.sign(b64({}), '') }).valid).toBe(false);
  });

  it('imza sha1(private + data + private) base64 formatındadır', () => {
    const data = b64({ a: 1 });
    expect(epoint.sign(data, PRIVATE)).toBe(crypto.createHash('sha1').update(PRIVATE + data + PRIVATE).digest('base64'));
  });

  it('ödəniş sorğusu imzalanır; provayderin qaytardığı ünvan yalnız epoint.az ola bilər', async () => {
    const calls = [];
    global.fetch = jest.fn(async (url, opts) => {
      calls.push({ url, body: opts.body });
      return { ok: true, status: 200, text: async () => JSON.stringify({ status: 'success', transaction: 'te99', redirect_url: 'https://epoint.az/pay/abc' }) };
    });
    const res = await epoint.createPayment({ providerOrderId: 'o10-abc', amount: 57, currency: 'AZN', description: 'Sifariş #10', language: 'az', successUrl: 'https://x/s', errorUrl: 'https://x/e' });
    expect(res).toEqual({ redirectUrl: 'https://epoint.az/pay/abc', transaction: 'te99' });
    const form = new URLSearchParams(calls[0].body);
    const sent = JSON.parse(Buffer.from(form.get('data'), 'base64').toString());
    expect(sent).toMatchObject({ public_key: 'i000000001', amount: 57, currency: 'AZN', order_id: 'o10-abc', success_redirect_url: 'https://x/s' });
    expect(form.get('signature')).toBe(epoint.sign(form.get('data'), PRIVATE));
    expect(JSON.stringify(sent)).not.toContain(PRIVATE);

    global.fetch = jest.fn(async () => ({ ok: true, status: 200, text: async () => JSON.stringify({ status: 'success', redirect_url: 'https://evil.example/phish' }) }));
    await expect(epoint.createPayment({ providerOrderId: 'o1', amount: 1, currency: 'AZN' })).rejects.toThrow(/etibarsız/);
    global.fetch = jest.fn(async () => ({ ok: true, status: 200, text: async () => JSON.stringify({ status: 'success', redirect_url: 'http://epoint.az/insecure' }) }));
    await expect(epoint.createPayment({ providerOrderId: 'o1', amount: 1, currency: 'AZN' })).rejects.toThrow(/etibarsız/);
    global.fetch = jest.fn(async () => ({ ok: true, status: 200, text: async () => JSON.stringify({ status: 'error', message: 'xəta' }) }));
    await expect(epoint.createPayment({ providerOrderId: 'o1', amount: 1, currency: 'AZN' })).rejects.toThrow(/başlatmadı/);
  });
});

describe('orderService: ödəniş üsulu', () => {
  const base = { customer_name: 'Ali', phone: '+994501112233', items: [{ product_id: 1, quantity: 2 }] };
  beforeEach(() => {
    orderRepository.insertOrder.mockImplementation(async (tx, o) => ({ id: 10, ...o }));
    orderRepository.findProductPrice.mockResolvedValue({ id: 1, price: 24, is_available: true, track_inventory: false });
  });

  it('defolt NAĞD: UNPAID yaranır və adminə dərhal çatdırılır', async () => {
    const created = await orderService.createOrder(base);
    expect(created.payment_method).toBe('CASH');
    expect(created.payment_status).toBe('UNPAID');
    expect(emitOrderCreated).toHaveBeenCalledTimes(1);
    expect(notificationService.create).toHaveBeenCalledTimes(1);
  });

  it('ONLİN: PENDING yaranır, ödəniş təsdiqlənənə qədər admin/mətbəx xəbər tutmur', async () => {
    const created = await orderService.createOrder({ ...base, payment_method: 'ONLINE' });
    expect(created.payment_status).toBe('PENDING');
    expect(emitOrderCreated).not.toHaveBeenCalled();
    expect(notificationService.create).not.toHaveBeenCalled();
  });

  it('onlayn söndürülübsə, provayder yoxdursa və ya naməlum üsulda 400', async () => {
    restaurantRepository.find.mockResolvedValue(restaurant({ pay_online: false }));
    await expect(orderService.createOrder({ ...base, payment_method: 'ONLINE' })).rejects.toMatchObject({ status: 400 });
    restaurantRepository.find.mockResolvedValue(restaurant({ pay_online: true }));
    process.env.PAYMENT_PROVIDER = '';
    await expect(orderService.createOrder({ ...base, payment_method: 'ONLINE' })).rejects.toMatchObject({ status: 400 });
    await expect(orderService.createOrder({ ...base, payment_method: 'BITCOIN' })).rejects.toMatchObject({ status: 400 });
    expect(sql.Transaction.instances.every((t) => t.commit.mock.calls.length === 0)).toBe(true);
  });

  it('bağlı üsul (kartla masada söndürülüb) qəbul edilmir; hamısı söndürülübsə nağd qalır', async () => {
    restaurantRepository.find.mockResolvedValue(restaurant({ pay_card_pos: false }));
    await expect(orderService.createOrder({ ...base, payment_method: 'CARD_POS' })).rejects.toMatchObject({ status: 400 });
    restaurantRepository.find.mockResolvedValue(restaurant({ pay_cash: false, pay_card_pos: false, pay_online: false }));
    expect((await orderService.createOrder(base)).payment_method).toBe('CASH');
  });

  it('sifariş yaradılarkən ödəniş üsulu tətbiqdən deyil, restoran ayarlarından yoxlanılır (validator)', () => {
    const { validateCreateOrderBody } = require('../src/validators/orderValidator');
    expect(validateCreateOrderBody({ ...base, payment_method: 'CARD_POS' })).toBeNull();
    expect(validateCreateOrderBody({ ...base, payment_method: 'X' })).toMatch(/Ödəniş üsulu/);
  });

  it('onlayn ödənişi təsdiqlənməyən sifariş mətbəxə keçirilə bilməz, yalnız ləğv edilə bilər', async () => {
    orderRepository.findStateForUpdate.mockResolvedValue({ id: 10, status: 'NEW', payment_method: 'ONLINE', payment_status: 'PENDING' });
    orderRepository.findItemsTx.mockResolvedValue([]);
    await expect(orderService.updateStatus(10, 'PREPARING', 1)).rejects.toMatchObject({ status: 409 });
    orderRepository.updateStatus.mockResolvedValue(order({ status: 'CANCELLED' }));
    await expect(orderService.updateStatus(10, 'CANCELLED', 1)).resolves.toMatchObject({ status: 'CANCELLED' });
  });
});

// QA (ödəniş probları): ləğv stoku qaytarmırdı; ləğv edilmiş sifariş yenidən açılırdı; ödənilmiş onlayn sifariş refund olmadan ləğv edilirdi
describe('orderService.updateStatus: ləğv və status keçid qaydaları', () => {
  const state = (over = {}) => ({ id: 10, status: 'NEW', payment_method: 'CASH', payment_status: 'UNPAID', ...over });
  beforeEach(() => {
    orderRepository.findItemsTx.mockResolvedValue([{ product_id: 1, quantity: 3 }, { product_id: 2, quantity: 1 }]);
    orderRepository.restoreStockTx.mockImplementation(async (db, productId) => (productId === 1 ? { id: 1, stock_quantity: 9 } : null)); // 2-ci məhsul stok izləmir
    orderRepository.updateStatus.mockImplementation(async (db, id, status) => order({ status }));
  });

  it('ləğv: stok izlənən məhsulların sayı qaytarılır, hərəkət yazılır, tranzaksiya commit olunur, məhsul hadisəsi göndərilir', async () => {
    orderRepository.findStateForUpdate.mockResolvedValue(state());
    const before = sql.Transaction.instances.length;
    await orderService.updateStatus(10, 'CANCELLED', 1, 'müştəri getdi');
    expect(orderRepository.restoreStockTx).toHaveBeenCalledWith(expect.anything(), 1, 3);
    expect(orderRepository.restoreStockTx).toHaveBeenCalledWith(expect.anything(), 2, 1);
    expect(orderRepository.insertStockMovementTx).toHaveBeenCalledTimes(1); // yalnız izlənən məhsul üçün
    expect(orderRepository.insertStockMovementTx).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ product_id: 1, change_qty: 3, reason: 'order_cancelled', order_id: 10 }));
    expect(sql.Transaction.instances[before].commit).toHaveBeenCalled();
    expect(require('../src/sockets/emit').emitProductUpdated).toHaveBeenCalledWith({ id: 1, stock_quantity: 9 }, 'updated');
  });

  it('ləğv edilməyən keçidlər (CONFIRMED, PREPARING…) stoka toxunmur', async () => {
    orderRepository.findStateForUpdate.mockResolvedValue(state());
    await orderService.updateStatus(10, 'PREPARING', 1);
    expect(orderRepository.restoreStockTx).not.toHaveBeenCalled();
  });

  it('artıq ləğv edilmiş sifarişi başqa statusa keçirmək olmaz (409, heç nə yazılmır); təkrar ləğv stoku ikinci dəfə qaytarmır', async () => {
    orderRepository.findStateForUpdate.mockResolvedValue(state({ status: 'CANCELLED' }));
    await expect(orderService.updateStatus(10, 'PREPARING', 1)).rejects.toMatchObject({ status: 409 });
    expect(orderRepository.insertStatusHistory).not.toHaveBeenCalled();
    await orderService.updateStatus(10, 'CANCELLED', 1);
    expect(orderRepository.restoreStockTx).not.toHaveBeenCalled();
    expect(orderRepository.insertStatusHistory).not.toHaveBeenCalled();
  });

  it('ödənilmiş onlayn sifariş refund olmadan ləğv edilə bilməz; refund-dan sonra (REFUNDED) ləğv olunur; nağd ödənilmiş sifariş ləğv olunur', async () => {
    orderRepository.findStateForUpdate.mockResolvedValue(state({ payment_method: 'ONLINE', payment_status: 'PAID' }));
    await expect(orderService.updateStatus(10, 'CANCELLED', 1)).rejects.toMatchObject({ status: 409, message: expect.stringMatching(/geri qaytarın/) });
    expect(orderRepository.restoreStockTx).not.toHaveBeenCalled();
    orderRepository.findStateForUpdate.mockResolvedValue(state({ payment_method: 'ONLINE', payment_status: 'REFUNDED' }));
    await expect(orderService.updateStatus(10, 'CANCELLED', 1)).resolves.toMatchObject({ status: 'CANCELLED' });
    orderRepository.findStateForUpdate.mockResolvedValue(state({ payment_method: 'CASH', payment_status: 'PAID' }));
    await expect(orderService.updateStatus(10, 'CANCELLED', 1)).resolves.toMatchObject({ status: 'CANCELLED' });
  });

  it('mövcud olmayan sifariş 404', async () => {
    orderRepository.findStateForUpdate.mockResolvedValue(null);
    await expect(orderService.updateStatus(999, 'CANCELLED', 1)).rejects.toMatchObject({ status: 404 });
  });
});

describe('restoran məlumatı', () => {
  it('onlayn ödənişin əlçatanlığı göstərilir, açarlar heç vaxt qaytarılmır', async () => {
    restaurantRepository.find.mockResolvedValue(restaurant());
    const r = await restaurantService.getRestaurant();
    expect(r.online_payment_available).toBe(true);
    expect(JSON.stringify(r)).not.toContain(PRIVATE);
    delete process.env.EPOINT_PRIVATE_KEY;
    expect((await restaurantService.getRestaurant()).online_payment_available).toBe(false);
  });
});

describe('paymentService.startOnlinePayment', () => {
  const token = 'tok-1234567890abcdef';
  beforeEach(() => {
    global.fetch = jest.fn(async () => ({ ok: true, status: 200, text: async () => JSON.stringify({ status: 'success', transaction: 'te7', redirect_url: 'https://epoint.az/pay/x' }) }));
  });

  it('məbləği DB-dəki sifarişdən götürür, cəhd yaradır və provayder ünvanını qaytarır', async () => {
    const res = await paymentService.startOnlinePayment(10, token, { language: 'az' });
    expect(res.redirect_url).toBe('https://epoint.az/pay/x');
    expect(paymentRepository.create).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ order_id: 10, amount: 57, method: 'ONLINE', provider: 'epoint' }));
    const sent = JSON.parse(Buffer.from(new URLSearchParams(global.fetch.mock.calls[0][1].body).get('data'), 'base64').toString());
    expect(sent.amount).toBe(57);
    expect(sent.success_redirect_url).toBe(`https://menu.example.az/order/10?token=${token}&pay=success`);
    expect(sent.error_redirect_url).toContain('&pay=error');
  });

  it('yanlış token 404; ödənilmiş/ləğv/onlayn olmayan sifariş 409; provayder yoxdursa 503', async () => {
    orderRepository.findAccessToken.mockResolvedValue('bashqa-token-1234567');
    await expect(paymentService.startOnlinePayment(10, token)).rejects.toMatchObject({ status: 404 });
    orderRepository.findAccessToken.mockResolvedValue(token);
    orderRepository.findById.mockResolvedValue(order({ payment_status: 'PAID' }));
    await expect(paymentService.startOnlinePayment(10, token)).rejects.toMatchObject({ status: 409 });
    orderRepository.findById.mockResolvedValue(order({ status: 'CANCELLED' }));
    await expect(paymentService.startOnlinePayment(10, token)).rejects.toMatchObject({ status: 409 });
    orderRepository.findById.mockResolvedValue(order({ payment_method: 'CASH', payment_status: 'UNPAID' }));
    await expect(paymentService.startOnlinePayment(10, token)).rejects.toMatchObject({ status: 409 });
    orderRepository.findById.mockResolvedValue(order());
    process.env.PAYMENT_PROVIDER = '';
    await expect(paymentService.startOnlinePayment(10, token)).rejects.toMatchObject({ status: 503 });
  });

  it('provayder xətasında cəhd FAILED olur, müştəriyə 502 (daxili detal göstərilmir)', async () => {
    global.fetch = jest.fn(async () => { throw new Error('ECONNRESET secret-host'); });
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(paymentService.startOnlinePayment(10, token)).rejects.toMatchObject({ status: 502, message: expect.not.stringContaining('secret-host') });
    spy.mockRestore();
    expect(paymentRepository.update).toHaveBeenCalledWith(expect.anything(), 5, expect.objectContaining({ status: 'FAILED' }));
  });
});

describe('paymentService.applyProviderResult', () => {
  const success = { providerOrderId: 'o10-abc', status: 'success', transaction: 'te1', amount: 57, cardMask: '415432******1234' };

  it('uğurlu ödəniş: cəhd SUCCESS, sifariş PAID, sifariş İLK DƏFƏ indi adminə çatdırılır', async () => {
    orderRepository.findById.mockResolvedValue(order({ payment_status: 'PAID' })); // commit-dən sonra DB artıq PAID göstərir
    const out = await paymentService.applyProviderResult(success);
    expect(out.changed).toBe(true);
    expect(paymentRepository.update).toHaveBeenCalledWith(expect.anything(), 5, expect.objectContaining({ status: 'SUCCESS', card_mask: '415432******1234' }));
    expect(orderRepository.setPaymentTx).toHaveBeenCalledWith(expect.anything(), 10, expect.objectContaining({ payment_status: 'PAID', paid_amount: 57, allowedFrom: ['PENDING', 'FAILED', 'UNPAID'] }));
    expect(sql.Transaction.instances[0].commit).toHaveBeenCalled();
    expect(emitOrderStatusUpdated).toHaveBeenCalled();
    expect(emitOrderCreated).toHaveBeenCalledTimes(1);
    expect(notificationService.create).toHaveBeenCalledWith(expect.objectContaining({ type: 'order_created', body: expect.stringContaining('ödənilib') }));
  });

  it('təkrar callback (provayder təkrarlayır) heç nəyi dəyişmir və ikinci bildiriş yaratmır', async () => {
    paymentRepository.findByProviderOrderIdForUpdate.mockResolvedValue(payment({ status: 'SUCCESS' }));
    const out = await paymentService.applyProviderResult(success);
    expect(out.changed).toBe(false);
    expect(orderRepository.setPaymentTx).not.toHaveBeenCalled();
    expect(emitOrderCreated).not.toHaveBeenCalled();
  });

  it('məbləğ uyğun deyilsə ödəniş TƏSDİQLƏNMİR, rollback və xəbərdarlıq', async () => {
    await expect(paymentService.applyProviderResult({ ...success, amount: 0.01 })).rejects.toMatchObject({ status: 400 });
    expect(orderRepository.setPaymentTx).not.toHaveBeenCalled();
    expect(sql.Transaction.instances[0].rollback).toHaveBeenCalled();
    expect(sql.Transaction.instances[0].commit).not.toHaveBeenCalled();
    expect(systemAlertService.report).toHaveBeenCalled();
    expect(emitOrderCreated).not.toHaveBeenCalled();
  });

  it('uğursuz ödəniş: cəhd və sifariş FAILED (yenidən cəhd olunur), admin xəbər tutmur; artıq ödənilmiş sifarişə toxunulmur', async () => {
    const out = await paymentService.applyProviderResult({ providerOrderId: 'o10-abc', status: 'failed', message: 'Kart rədd edildi' });
    expect(out.kind).toBe('failed');
    expect(paymentRepository.update).toHaveBeenCalledWith(expect.anything(), 5, expect.objectContaining({ status: 'FAILED', failure_reason: 'Kart rədd edildi' }));
    expect(orderRepository.setPaymentTx).toHaveBeenCalledWith(expect.anything(), 10, expect.objectContaining({ payment_status: 'FAILED', allowedFrom: ['PENDING'] }));
    expect(emitOrderCreated).not.toHaveBeenCalled();
  });

  it('gözləmə statusu heç nə dəyişmir; naməlum ödəniş 404', async () => {
    expect((await paymentService.applyProviderResult({ providerOrderId: 'o10-abc', status: 'pending' })).changed).toBe(false);
    expect(sql.Transaction.instances).toHaveLength(0);
    paymentRepository.findByProviderOrderId.mockResolvedValue(null);
    await expect(paymentService.applyProviderResult(success)).rejects.toMatchObject({ status: 404 });
  });

  it('ləğv olunmuş sifariş üçün gecikmiş ödəniş: sifariş elan edilmir, işçiyə "geri qaytarın" xəbərdarlığı', async () => {
    orderRepository.setPaymentTx.mockResolvedValue(order({ status: 'CANCELLED', payment_status: 'PAID', paid_amount: 57 }));
    await paymentService.applyProviderResult(success);
    expect(emitOrderCreated).not.toHaveBeenCalled();
    expect(systemAlertService.report).toHaveBeenCalledWith(expect.stringContaining('late-payment'), expect.any(String), expect.stringContaining('geri qaytarın'));
  });

  it('geri qaytarma bildirişi: SUCCESS → REFUNDED', async () => {
    paymentRepository.findByProviderOrderIdForUpdate.mockResolvedValue(payment({ status: 'SUCCESS' }));
    const out = await paymentService.applyProviderResult({ providerOrderId: 'o10-abc', status: 'refunded' });
    expect(out.kind).toBe('refunded');
    expect(orderRepository.setPaymentTx).toHaveBeenCalledWith(expect.anything(), 10, expect.objectContaining({ payment_status: 'REFUNDED', allowedFrom: ['PAID'] }));
  });
});

describe('paymentService: yoxlama, əllə ödəniş, vaxt aşımı', () => {
  const token = 'tok-1234567890abcdef';

  it('verify: callback gəlməyibsə provayderdən status soruşulur və uğurlu isə sifariş PAID olur; nəticədə token qaytarılmır', async () => {
    paymentRepository.findPendingWithTransaction.mockResolvedValue([payment({ provider_transaction: 'te1' })]);
    global.fetch = jest.fn(async () => ({ ok: true, status: 200, text: async () => JSON.stringify({ status: 'success', transaction: 'te1', order_id: 'o10-abc', amount: '57.00' }) }));
    const res = await paymentService.verifyOrderPayment(10, token);
    expect(orderRepository.setPaymentTx).toHaveBeenCalledWith(expect.anything(), 10, expect.objectContaining({ payment_status: 'PAID' }));
    expect(res.access_token).toBeUndefined();
  });

  it('verify: məbləği olmayan "uğurlu" cavab təsdiqlənmir (callback gözlənilir)', async () => {
    paymentRepository.findPendingWithTransaction.mockResolvedValue([payment({ provider_transaction: 'te1' })]);
    global.fetch = jest.fn(async () => ({ ok: true, status: 200, text: async () => JSON.stringify({ status: 'success', transaction: 'te1' }) }));
    await paymentService.verifyOrderPayment(10, token);
    expect(orderRepository.setPaymentTx).not.toHaveBeenCalled();
  });

  it('verify: provayder xətası sifarişi pozmur', async () => {
    paymentRepository.findPendingWithTransaction.mockResolvedValue([payment({ provider_transaction: 'te1' })]);
    global.fetch = jest.fn(async () => { throw new Error('timeout'); });
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(paymentService.verifyOrderPayment(10, token)).resolves.toMatchObject({ id: 10 });
    spy.mockRestore();
    expect(orderRepository.setPaymentTx).not.toHaveBeenCalled();
  });

  it('əllə ödəniş: nağd → PAID + manual cəhd yazılır; onlayn/ödənilmiş/ləğv 409; yanlış üsul 400', async () => {
    orderRepository.findById.mockResolvedValue(order({ payment_method: 'CASH', payment_status: 'UNPAID' }));
    const { order: updated } = await paymentService.markPaidManually(10, 3, 'CARD_POS');
    expect(updated.payment_status).toBe('PAID');
    expect(paymentRepository.create).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ provider: 'manual', method: 'CARD_POS', status: 'SUCCESS', created_by: 3, amount: 57 }));
    expect(orderRepository.setPaymentTx).toHaveBeenCalledWith(expect.anything(), 10, expect.objectContaining({ payment_method: 'CARD_POS', allowedFrom: ['UNPAID'] }));

    orderRepository.findById.mockResolvedValue(order());
    await expect(paymentService.markPaidManually(10, 3)).rejects.toMatchObject({ status: 409 });
    orderRepository.findById.mockResolvedValue(order({ payment_method: 'CASH', payment_status: 'PAID' }));
    await expect(paymentService.markPaidManually(10, 3)).rejects.toMatchObject({ status: 409 });
    orderRepository.findById.mockResolvedValue(order({ payment_method: 'CASH', payment_status: 'UNPAID', status: 'CANCELLED' }));
    await expect(paymentService.markPaidManually(10, 3)).rejects.toMatchObject({ status: 409 });
    orderRepository.findById.mockResolvedValue(order({ payment_method: 'CASH', payment_status: 'UNPAID' }));
    await expect(paymentService.markPaidManually(10, 3, 'ONLINE')).rejects.toMatchObject({ status: 400 });
  });

  it('vaxtı keçmiş ödənilməmiş onlayn sifariş ləğv olunur, stok geri qaytarılır, açıq cəhdlər bağlanır', async () => {
    orderRepository.findExpiredUnpaidOnline.mockResolvedValue([10]);
    orderRepository.findStateForUpdate.mockResolvedValue({ id: 10, status: 'NEW', payment_method: 'ONLINE', payment_status: 'PENDING' });
    orderRepository.updateStatus.mockResolvedValue(order({ status: 'CANCELLED' }));
    orderRepository.findItemsTx.mockResolvedValue([{ product_id: 1, quantity: 2 }]);
    orderRepository.restoreStockTx.mockResolvedValue({ id: 1, stock_quantity: 5 });
    expect(await paymentService.expireUnpaidOnlineOrders()).toBe(1);
    expect(orderRepository.updateStatus).toHaveBeenCalledWith(expect.anything(), 10, 'CANCELLED');
    expect(orderRepository.restoreStockTx).toHaveBeenCalledWith(expect.anything(), 1, 2);
    expect(orderRepository.insertStockMovementTx).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ change_qty: 2, reason: 'order_expired' }));
    expect(paymentRepository.failOpenForOrder).toHaveBeenCalledWith(expect.anything(), 10, expect.any(String));
    expect(sql.Transaction.instances[0].commit).toHaveBeenCalled();
  });

  // Siyahı seçildikdən sonra müştəri ödəyə bilərdi — ödənilmiş sifariş HEÇ VAXT ləğv edilməməlidir
  it('sweeper: siyahıdan sonra ödənilmiş (və ya artıq ləğv/hazırlanan) sifariş ləğv edilmir, rollback olur, stok toxunulmaz', async () => {
    orderRepository.findExpiredUnpaidOnline.mockResolvedValue([10]);
    for (const race of [{ payment_status: 'PAID' }, { status: 'PREPARING' }, { status: 'CANCELLED' }]) {
      jest.clearAllMocks();
      sql.Transaction.instances.length = 0;
      orderRepository.findExpiredUnpaidOnline.mockResolvedValue([10]);
      orderRepository.findStateForUpdate.mockResolvedValue({ id: 10, status: 'NEW', payment_method: 'ONLINE', payment_status: 'PENDING', ...race });
      expect(await paymentService.expireUnpaidOnlineOrders()).toBe(0);
      expect(orderRepository.updateStatus).not.toHaveBeenCalled();
      expect(orderRepository.restoreStockTx).not.toHaveBeenCalled();
      expect(sql.Transaction.instances[0].rollback).toHaveBeenCalled();
      expect(sql.Transaction.instances[0].commit).not.toHaveBeenCalled();
    }
  });
});

describe('sxema ilə kod uyğunluğu (unit testlər DB-ni mock etdiyi üçün CHECK pozuntusunu görmürdü)', () => {
  it("koddakı stock_movements `reason` dəyərlərinin hamısı schema.sql və 019 miqrasiyasındakı CHECK-də var", () => {
    const fs = require('fs');
    const path = require('path');
    const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
    const src = path.join(__dirname, '..', 'src');
    const used = new Set();
    for (const file of walk(src).filter((f) => f.endsWith('.js'))) {
      const text = fs.readFileSync(file, 'utf8');
      for (const m of text.matchAll(/insertStockMovementTx\([^)]*reason:\s*'(\w+)'/g)) used.add(m[1]);
      for (const m of text.matchAll(/\.input\('reason',\s*sql\.NVarChar\(\d+\),\s*'(\w+)'\)/g)) used.add(m[1]);
    }
    expect([...used].length).toBeGreaterThan(0);
    const schema = fs.readFileSync(path.join(__dirname, '..', 'database', 'schema.sql'), 'utf8');
    const migration = fs.readFileSync(path.join(__dirname, '..', 'database', 'migrations', '019_stock_movement_reasons.sql'), 'utf8');
    for (const reason of used) {
      expect(schema).toContain(`N'${reason}'`);
      expect(migration).toContain(`N'${reason}'`);
    }
  });
});

describe('HTTP: ödəniş endpoint-ləri', () => {
  it('callback: imza etibarsızdırsa 400 və heç nə dəyişmir', async () => {
    const res = await request(app).post('/api/payments/epoint/callback').type('form').send({ data: b64({ order_id: 'o10-abc', status: 'success', amount: 57 }), signature: 'saxta' });
    expect(res.status).toBe(400);
    expect(orderRepository.setPaymentTx).not.toHaveBeenCalled();
  });

  it('callback: düzgün imza ilə form-urlencoded gəlir → 200 ok, sifariş PAID', async () => {
    const res = await request(app).post('/api/payments/epoint/callback').type('form').send(signed({ order_id: 'o10-abc', status: 'success', transaction: 'te1', amount: 57 }));
    expect(res.status).toBe(200);
    expect(res.text).toBe('ok');
    expect(orderRepository.setPaymentTx).toHaveBeenCalledWith(expect.anything(), 10, expect.objectContaining({ payment_status: 'PAID' }));
  });

  it('start: token olmadan 400; düzgün token ilə provayder ünvanı', async () => {
    global.fetch = jest.fn(async () => ({ ok: true, status: 200, text: async () => JSON.stringify({ status: 'success', transaction: 't', redirect_url: 'https://epoint.az/p' }) }));
    expect((await request(app).post('/api/payments/orders/10/start').send({})).status).toBe(400);
    const ok = await request(app).post('/api/payments/orders/10/start').send({ token: 'tok-1234567890abcdef' });
    expect(ok.status).toBe(200);
    expect(ok.body.redirect_url).toBe('https://epoint.az/p');
    expect((await request(app).post('/api/payments/orders/abc/start').send({ token: 'tok-1234567890abcdef' })).status).toBe(400);
  });

  it('sınaq provayderi: production-da və ya imzasız işləmir, inkişafda imza ilə işləyir', async () => {
    setEnv('test');
    const poid = 'o10-abc';
    const sig = testProvider.signOrder(poid);
    orderRepository.findById.mockResolvedValue(order({ payment_status: 'PAID' }));
    expect((await request(app).post('/api/payments/test/complete').send({ o: poid, sig: 'x'.repeat(64), outcome: 'success' })).status).toBe(403);
    expect((await request(app).post('/api/payments/test/complete').send({ o: poid, sig, outcome: 'hack' })).status).toBe(400);
    const ok = await request(app).post('/api/payments/test/complete').send({ o: poid, sig, outcome: 'success' });
    expect(ok.status).toBe(200);
    expect(orderRepository.setPaymentTx).toHaveBeenCalled();

    process.env.NODE_ENV = 'production';
    orderRepository.setPaymentTx.mockClear();
    expect((await request(app).post('/api/payments/test/complete').send({ o: poid, sig, outcome: 'success' })).status).toBe(404);
    expect(orderRepository.setPaymentTx).not.toHaveBeenCalled();
    process.env.NODE_ENV = 'test';
  });

  it('əllə ödəniş: mətbəx 403, giriş yoxdursa 401, ofisiant/menecer 200', async () => {
    orderRepository.findById.mockResolvedValue(order({ payment_method: 'CASH', payment_status: 'UNPAID' }));
    expect((await request(app).post('/api/orders/10/payment').send({})).status).toBe(401);
    expect((await request(app).post('/api/orders/10/payment').set('Cookie', cookieFor('KITCHEN')).send({})).status).toBe(403);
    expect((await request(app).post('/api/orders/10/payment').set('Cookie', cookieFor('WAITER')).send({ method: 'CARD_POS' })).status).toBe(200);
    expect((await request(app).post('/api/orders/10/payment').set('Cookie', cookieFor('OWNER')).send({ method: 'BITCOIN' })).status).toBe(400);
  });

  it('ödəniş cəhdləri siyahısı yalnız girişli işçiyə', async () => {
    paymentRepository.listByOrder.mockResolvedValue([{ id: 1, status: 'SUCCESS' }]);
    expect((await request(app).get('/api/orders/10/payments')).status).toBe(401);
    const res = await request(app).get('/api/orders/10/payments').set('Cookie', cookieFor('MANAGER'));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });
});

describe('Epoint sənədinə uyğunluq: geri qaytarma, heartbeat, valyuta', () => {
  it('geri qaytarma /reverse endpoint-inə tranzaksiya, məbləğ və valyuta ilə imzalı sorğu göndərir', async () => {
    const calls = [];
    global.fetch = jest.fn(async (url, opts) => {
      calls.push({ url, body: opts.body });
      return { ok: true, status: 200, text: async () => JSON.stringify({ status: 'success' }) };
    });
    await expect(epoint.refund({ transaction: 'te123', amount: 57, currency: 'AZN' })).resolves.toEqual({ ok: true });
    expect(calls[0].url).toBe('https://epoint.az/api/1/reverse');
    const form = new URLSearchParams(calls[0].body);
    expect(JSON.parse(Buffer.from(form.get('data'), 'base64').toString())).toEqual({ public_key: 'i000000001', language: 'az', transaction: 'te123', currency: 'AZN', amount: 57 });
    expect(form.get('signature')).toBe(epoint.sign(form.get('data'), PRIVATE));

    global.fetch = jest.fn(async () => ({ ok: true, status: 200, text: async () => JSON.stringify({ status: 'error', message: 'Yetərsiz balans' }) }));
    await expect(epoint.refund({ transaction: 'te123', amount: 57 })).rejects.toThrow('Yetərsiz balans');
    await expect(epoint.refund({ amount: 5 })).rejects.toThrow(/Tranzaksiya/);
  });

  it('ödəniş sorğusu rəsmi ünvana gedir; AZN-dən başqa valyuta göndərilmir; açıqlama 1000 simvola qədər', async () => {
    const calls = [];
    global.fetch = jest.fn(async (url, opts) => {
      calls.push({ url, body: opts.body });
      return { ok: true, status: 200, text: async () => JSON.stringify({ status: 'success', transaction: 't1', redirect_url: 'https://epoint.az/x' }) };
    });
    await epoint.createPayment({ providerOrderId: 'o1', amount: 10, currency: 'AZN', description: 'x'.repeat(1500), language: 'ru' });
    expect(calls[0].url).toBe('https://epoint.az/api/1/request');
    const sent = JSON.parse(Buffer.from(new URLSearchParams(calls[0].body).get('data'), 'base64').toString());
    expect(sent.description).toHaveLength(1000);
    expect(sent.language).toBe('ru');
    await expect(epoint.createPayment({ providerOrderId: 'o2', amount: 10, currency: 'USD' })).rejects.toThrow(/AZN/);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('status sorğusu /get-status; server_error və new "gözləyir" sayılır (ödənilmiş SAYILMIR)', async () => {
    const urls = [];
    global.fetch = jest.fn(async (url) => {
      urls.push(url);
      return { ok: true, status: 200, text: async () => JSON.stringify({ status: 'server_error', order_id: 'o1' }) };
    });
    const res = await epoint.fetchStatus({ transaction: 'te1' });
    expect(urls[0]).toBe('https://epoint.az/api/1/get-status');
    expect(res.status).toBe('pending');
  });

  it('heartbeat: status ok → true, əks halda false', async () => {
    global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ status: 'ok' }) }));
    expect(await epoint.heartbeat()).toBe(true);
    expect(global.fetch.mock.calls[0][0]).toBe('https://epoint.az/api/heartbeat');
    global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ status: 'down' }) }));
    expect(await epoint.heartbeat()).toBe(false);
  });
});

describe('paymentService.refundOrder', () => {
  const paid = (over = {}) => order({ payment_status: 'PAID', paid_amount: 57, ...over });
  beforeEach(() => {
    orderRepository.findById.mockResolvedValue(paid());
    paymentRepository.findSuccessfulByOrder.mockResolvedValue(payment({ status: 'SUCCESS', provider_transaction: 'te1' }));
    global.fetch = jest.fn(async () => ({ ok: true, status: 200, text: async () => JSON.stringify({ status: 'success' }) }));
  });

  it('ödənilmiş onlayn sifariş: əvvəl baza REFUNDED olur (PAID → REFUNDED), sonra Epoint-ə /reverse göndərilir', async () => {
    const out = await paymentService.refundOrder(10, 1);
    expect(out.order.payment_status).toBe('REFUNDED');
    expect(paymentRepository.update).toHaveBeenCalledWith(expect.anything(), 5, { status: 'REFUNDED' });
    expect(orderRepository.setPaymentTx).toHaveBeenCalledWith(expect.anything(), 10, expect.objectContaining({ payment_status: 'REFUNDED', allowedFrom: ['PAID'] }));
    expect(global.fetch.mock.calls[0][0]).toBe('https://epoint.az/api/1/reverse');
    expect(emitOrderStatusUpdated).toHaveBeenCalled();
  });

  it('ikiqat klik: ikinci sorğu artıq REFUNDED görür (409) və Epoint-ə heç nə göndərilmir', async () => {
    orderRepository.setPaymentTx.mockResolvedValue(null); // keçid artıq başqa sorğu tərəfindən edilib
    await expect(paymentService.refundOrder(10, 1)).rejects.toMatchObject({ status: 409 });
    expect(global.fetch).not.toHaveBeenCalled();
    expect(sql.Transaction.instances[0].rollback).toHaveBeenCalled();
  });

  it('Epoint rədd edərsə status geri qaytarılır (PAID) ki, yenidən cəhd olunsun; 502', async () => {
    global.fetch = jest.fn(async () => ({ ok: true, status: 200, text: async () => JSON.stringify({ status: 'error', message: 'Rədd' }) }));
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(paymentService.refundOrder(10, 1)).rejects.toMatchObject({ status: 502 });
    spy.mockRestore();
    expect(paymentRepository.update).toHaveBeenLastCalledWith(expect.anything(), 5, { status: 'SUCCESS' });
    expect(orderRepository.setPaymentTx).toHaveBeenLastCalledWith(expect.anything(), 10, expect.objectContaining({ payment_status: 'PAID', allowedFrom: ['REFUNDED'] }));
  });

  it('onlayn olmayan, ödənilməmiş və artıq qaytarılmış sifarişlər 409; naməlum sifariş 404', async () => {
    orderRepository.findById.mockResolvedValue(paid({ payment_method: 'CASH' }));
    await expect(paymentService.refundOrder(10, 1)).rejects.toMatchObject({ status: 409 });
    orderRepository.findById.mockResolvedValue(order({ payment_status: 'PENDING' }));
    await expect(paymentService.refundOrder(10, 1)).rejects.toMatchObject({ status: 409 });
    orderRepository.findById.mockResolvedValue(paid({ payment_status: 'REFUNDED' }));
    await expect(paymentService.refundOrder(10, 1)).rejects.toMatchObject({ status: 409 });
    orderRepository.findById.mockResolvedValue(null);
    await expect(paymentService.refundOrder(10, 1)).rejects.toMatchObject({ status: 404 });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('HTTP: yalnız OWNER/MANAGER geri qaytara bilər (ofisiant/mətbəx 403, girişsiz 401)', async () => {
    expect((await request(app).post('/api/orders/10/refund')).status).toBe(401);
    expect((await request(app).post('/api/orders/10/refund').set('Cookie', cookieFor('WAITER'))).status).toBe(403);
    expect((await request(app).post('/api/orders/10/refund').set('Cookie', cookieFor('KITCHEN'))).status).toBe(403);
    const ok = await request(app).post('/api/orders/10/refund').set('Cookie', cookieFor('MANAGER'));
    expect(ok.status).toBe(200);
    expect(ok.body.payment_status).toBe('REFUNDED');
  });
});

describe('Brauzerə etibar edilmir: sifariş və məbləğ yalnız serverdə formalaşır', () => {
  const evil = {
    customer_name: 'Hacker',
    phone: '+994501112233',
    items: [{ product_id: 1, quantity: 2, price: 0.01, name: 'Bedava' }],
    payment_method: 'ONLINE',
    // brauzerin göndərə biləcəyi, lakin server tərəfindən UMUMİYYƏTLƏ oxunmamalı sahələr:
    total: 0.01, subtotal: 0.01, discount: 999, vat: 0, payment_status: 'PAID', paid_amount: 57, paid_at: '2020-01-01', status: 'COMPLETED', id: 1, access_token: 'oz-tokenim',
  };

  beforeEach(() => {
    orderRepository.insertOrder.mockImplementation(async (tx, o) => ({ id: 10, ...o }));
    orderRepository.findProductPrice.mockResolvedValue({ id: 1, price: 24, is_available: true, track_inventory: false });
  });

  it('servis: məbləğ bazadakı qiymətdən hesablanır; total/price/status/payment_status/paid_* göndərilsə də nəzərə alınmır, ödəniş PENDING başlayır', async () => {
    const created = await orderService.createOrder(evil);
    expect(orderRepository.insertOrder).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ subtotal: 48, total: 48, discount: 0, payment_method: 'ONLINE', payment_status: 'PENDING' }));
    const inserted = orderRepository.insertOrder.mock.calls[0][1];
    expect(inserted.access_token).not.toBe('oz-tokenim'); // token serverdə təsadüfi yaradılır
    expect(inserted.status).toBeUndefined(); // status DB defoltudur (NEW)
    expect(inserted.paid_at).toBeUndefined();
    expect(inserted.paid_amount).toBeUndefined();
    expect(created.total).toBe(48);
    expect(emitOrderCreated).not.toHaveBeenCalled(); // ödəniş təsdiqlənməyib
  });

  it('HTTP: POST /api/orders eyni saxta sahələrlə göndərilsə də sifariş bazadakı qiymətlə, PENDING yaranır', async () => {
    const res = await request(app).post('/api/orders').send(evil);
    expect(res.status).toBe(201);
    expect(res.body.total).toBe(48);
    expect(res.body.payment_status).toBe('PENDING');
    expect(res.body.status).toBeUndefined();
  });

  it('gözlənilən məbləğ (expected_total) yalnız uyğunluq yoxlamasıdır: fərqlidirsə sifariş YARANMIR (409), məbləğ kimi istifadə olunmur', async () => {
    await expect(orderService.createOrder({ ...evil, expected_total: 0.01 })).rejects.toMatchObject({ status: 409 });
    expect(orderRepository.insertOrder).not.toHaveBeenCalled();
  });

  it('ödəniş başlayanda provayderə gedən məbləğ DB-dəki sifariş məbləğidir; sorğu gövdəsindəki amount/total nəzərə alınmır', async () => {
    global.fetch = jest.fn(async () => ({ ok: true, status: 200, text: async () => JSON.stringify({ status: 'success', transaction: 't', redirect_url: 'https://epoint.az/p' }) }));
    const res = await request(app).post('/api/payments/orders/10/start').send({ token: 'tok-1234567890abcdef', amount: 0.01, total: 0.01, currency: 'USD', payment_status: 'PAID' });
    expect(res.status).toBe(200);
    const sent = JSON.parse(Buffer.from(new URLSearchParams(global.fetch.mock.calls[0][1].body).get('data'), 'base64').toString());
    expect(sent.amount).toBe(57);
    expect(sent.currency).toBe('AZN');
    expect(paymentRepository.create).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ amount: 57, currency: 'AZN' }));
  });

  it('"ödənilib" statusunu brauzer təyin edə bilməz: yalnız imzalı callback, provayder status sorğusu və ya işçi (nağd)', async () => {
    // müştəri tərəfli heç bir endpoint payment_status qəbul etmir
    paymentRepository.findPendingWithTransaction.mockResolvedValue([payment({ provider_transaction: 'te1' })]);
    global.fetch = jest.fn(async () => ({ ok: true, status: 200, text: async () => JSON.stringify({ status: 'new', order_id: 'o10-abc' }) })); // Epoint: ödəniş hələ tamamlanmayıb
    const v = await request(app).post('/api/payments/orders/10/verify').send({ token: 'tok-1234567890abcdef', payment_status: 'PAID', status: 'success' });
    expect(v.status).toBe(200);
    expect(orderRepository.setPaymentTx).not.toHaveBeenCalled(); // provayder statusu "pending" olduğu üçün heç nə dəyişmədi
    // imzasız callback
    const cb = await request(app).post('/api/payments/epoint/callback').type('form').send({ data: b64({ order_id: 'o10-abc', status: 'success', amount: 57 }), signature: '' });
    expect(cb.status).toBe(400);
    // əllə "ödənildi" yalnız girişli işçiyə
    expect((await request(app).post('/api/orders/10/payment').send({ payment_status: 'PAID' })).status).toBe(401);
    expect(orderRepository.setPaymentTx).not.toHaveBeenCalled();
  });
});
