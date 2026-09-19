const crypto = require('crypto');
const { sql, poolPromise } = require('../config/db');
const orderRepository = require('../repositories/orderRepository');
const tableRepository = require('../repositories/tableRepository');
const promoRepository = require('../repositories/promoRepository');
const notificationService = require('./notificationService');
const restaurantRepository = require('../repositories/restaurantRepository');
const promoService = require('./promoService');
const pricingService = require('./pricingService');
const AppError = require('../utils/AppError');
const { isOnlineAvailable } = require('./payments');
const { emitOrderCreated, emitOrderStatusUpdated, emitProductUpdated } = require('../sockets/emit');

const DEFAULT_RESTAURANT_ID = 1;
const PAYMENT_METHODS = ['CASH', 'CARD_POS', 'ONLINE'];

// Hansı ödəniş üsulları müştəriyə təklif olunur (restoran ayarları + onlayn provayder qoşulubmu)
function enabledPaymentMethods(restaurant) {
  const enabled = {
    CASH: restaurant?.pay_cash !== false,
    CARD_POS: restaurant?.pay_card_pos !== false,
    ONLINE: !!restaurant?.pay_online && isOnlineAvailable(),
  };
  if (!enabled.CASH && !enabled.CARD_POS && !enabled.ONLINE) enabled.CASH = true; // ən azı bir üsul həmişə var
  return enabled;
}

function resolvePaymentMethod(requested, restaurant) {
  const enabled = enabledPaymentMethods(restaurant);
  const method = requested || PAYMENT_METHODS.find((m) => enabled[m]);
  if (!PAYMENT_METHODS.includes(method)) throw new AppError(400, 'Ödəniş üsulu düzgün deyil');
  if (!enabled[method]) throw new AppError(400, 'Bu ödəniş üsulu hazırda mövcud deyil');
  return method;
}

const LOW_STOCK_THRESHOLD = 5; // dashboard-dakı "az qalan stok" həddi ilə eyni

// Stok 0-a düşəndə (məhsul avtomatik "Bitib" olur) və ya həddi keçəndə (ilk dəfə) admin bildirişi
async function notifyStockLevel(product, orderedQty) {
  const remaining = Number(product.stock_quantity);
  if (remaining <= 0) {
    await notificationService.create({
      type: 'out_of_stock',
      title: `Məhsul bitib: ${product.name}`,
      body: 'Stok 0-a düşdü — məhsul müştərilər üçün avtomatik bağlandı',
      entity_type: 'product',
      entity_id: product.id,
    });
  } else if (remaining <= LOW_STOCK_THRESHOLD && remaining + orderedQty > LOW_STOCK_THRESHOLD) {
    await notificationService.create({
      type: 'low_stock',
      title: `Stok azalır: ${product.name}`,
      body: `Qalıb: ${remaining} ədəd`,
      entity_type: 'product',
      entity_id: product.id,
    });
  }
}

// Eyni məhsulun təkrarlanan sətirlərini birləşdirir (PDF 3.6 — duplicate item merging).
function mergeItems(items) {
  const map = new Map();
  for (const it of items) {
    map.set(it.product_id, (map.get(it.product_id) || 0) + Number(it.quantity));
  }
  return [...map].map(([product_id, quantity]) => ({ product_id, quantity }));
}

// Səbətin cari (DB) qiymətləri ilə tam hesablanmış önizləməsi — sifariş yaratmadan.
// Frontend heç vaxt yekun məbləğin mənbəyi deyil; bu endpoint checkout-dan əvvəl göstərmək üçündür.
async function quote({ table_code, items, promo_code }) {
  const pool = await poolPromise;
  let table = null;
  if (table_code) {
    table = await tableRepository.findByCode(table_code);
    if (!table || !table.is_active) throw new AppError(400, 'Masa tapılmadı və ya aktiv deyil');
  }

  let subtotal = 0;
  const lines = [];
  for (const item of mergeItems(items)) {
    const product = await orderRepository.findProductPrice(pool, item.product_id);
    const price = product ? Number(product.price) : 0;
    const available = !!product && !!product.is_available && product.is_visible !== false;
    const inStock = !product?.track_inventory || (product.stock_quantity ?? 0) >= item.quantity;
    if (available && inStock) subtotal += price * item.quantity;
    lines.push({ product_id: item.product_id, quantity: item.quantity, price, available: available && inStock });
  }

  let discount = 0;
  let promo_error = null;
  if (promo_code && subtotal > 0) {
    try {
      discount = (await promoService.validateAndCompute(pool, promo_code.trim().toUpperCase(), subtotal)).discount;
    } catch (err) {
      if (!(err instanceof AppError)) throw err;
      promo_error = err.message;
    }
  }

  const settings = pricingService.settingsFrom(await restaurantRepository.find(DEFAULT_RESTAURANT_ID));
  const breakdown = pricingService.compute({ subtotal, discount, ...settings, isTakeaway: !table });
  return { ...breakdown, currency: settings.currency, items: lines, promo_error };
}

// Eyni client_request_id ilə təkrar sorğu (offline növbə, şəbəkə kəsilməsi, qoşa klik) ikinci sifariş yaratmır — mövcud sifariş qaytarılır.
// ID-ni bilməyən kənar şəxsin başqasının sifarişinin tokenini ala bilməməsi üçün telefon da uyğun gəlməlidir.
async function findReplay(pool, clientRequestId, phone) {
  if (!clientRequestId) return null;
  const existing = await orderRepository.findIdByClientRequestId(pool, clientRequestId);
  if (!existing) return null;
  if (existing.phone !== phone) throw new AppError(409, 'Bu sorğu ID-si artıq istifadə olunub');
  return { ...(await orderRepository.findById(pool, existing.id)), replayed: true };
}

const isUniqueViolation = (err) => err && (err.number === 2601 || err.number === 2627);

async function createOrder({ table_code, customer_name, phone, note, items: rawItems, promo_code, client_request_id, expected_total, payment_method }) {
  const items = mergeItems(rawItems);
  const pool = await poolPromise;
  const replay = await findReplay(pool, client_request_id, phone);
  if (replay) return replay;
  let table = null;
  if (table_code) {
    table = await tableRepository.findByCode(table_code);
    if (!table || !table.is_active) throw new AppError(400, 'Masa tapılmadı və ya aktiv deyil');
  }

  let transaction;
  try {
    transaction = new sql.Transaction(pool);
    await transaction.begin();

    let subtotal = 0;
    const priceRows = [];
    const stockUpdatedProducts = [];
    for (const item of items) {
      const product = await orderRepository.findProductPrice(transaction, item.product_id);
      if (!product) throw new AppError(400, `Məhsul tapılmadı: ${item.product_id}`);
      // gizli məhsul sifariş oluna bilməz (varlığı da açıqlanmır — "mövcud deyil" kimi cavab)
      if (!product.is_available || product.is_visible === false) throw new AppError(400, `Məhsul hazırda mövcud deyil: ${item.product_id}`);

      if (product.track_inventory) {
        const updated = await orderRepository.decrementStockTx(transaction, item.product_id, item.quantity);
        if (!updated) throw new AppError(400, `Kifayət qədər stok yoxdur: ${item.product_id}`);
        stockUpdatedProducts.push(updated);
      }

      const price = Number(product.price);
      subtotal += price * item.quantity;
      priceRows.push({ product_id: item.product_id, quantity: item.quantity, price });
    }

    let discount = 0;
    let promo = null;
    if (promo_code) {
      const result = await promoService.validateAndCompute(transaction, promo_code.trim().toUpperCase(), subtotal);
      promo = result.promo;
      discount = result.discount;
    }
    const restaurant = await restaurantRepository.find(DEFAULT_RESTAURANT_ID);
    const method = resolvePaymentMethod(payment_method, restaurant);
    const settings = pricingService.settingsFrom(restaurant);
    const pricing = pricingService.compute({ subtotal, discount, ...settings, isTakeaway: !table });
    const total = pricing.total;

    // Müştərinin gördüyü məbləğ ilə cari (DB) məbləğ fərqlənirsə sifariş yaradılmır — müştəri yeni məbləği təsdiq etməlidir (PDF 3.6)
    if (expected_total != null && Math.abs(Number(expected_total) - total) > 0.005) {
      throw new AppError(409, 'Qiymət dəyişib. Sifarişi yeni məbləğlə yeniləmək istəyirsiniz?', {
        code: 'PRICE_CHANGED',
        previous_total: Number(expected_total),
        total,
        currency: settings.currency,
        breakdown: pricing,
      });
    }

    const order = await orderRepository.insertOrder(transaction, {
      restaurant_id: DEFAULT_RESTAURANT_ID,
      table_id: table?.id,
      table_session_id: null,
      customer_name,
      phone,
      note,
      subtotal: pricing.subtotal,
      discount: pricing.discount,
      vat: pricing.vat,
      service_fee: pricing.service_fee,
      delivery_fee: pricing.delivery_fee,
      currency: settings.currency,
      total,
      promo_code_id: promo?.id,
      promo_code: promo?.code,
      access_token: crypto.randomBytes(16).toString('hex'),
      client_request_id,
      payment_method: method,
      // onlayn: ödəniş təsdiqlənənə qədər sifariş mətbəxə/adminə çatmır
      payment_status: method === 'ONLINE' ? 'PENDING' : 'UNPAID',
    });

    for (const row of priceRows) {
      await orderRepository.insertOrderItem(transaction, {
        order_id: order.id,
        product_id: row.product_id,
        quantity: row.quantity,
        price_at_order: row.price,
      });
      const trackedStock = stockUpdatedProducts.find((p) => p.id === row.product_id);
      if (trackedStock) {
        await orderRepository.insertStockMovementTx(transaction, {
          product_id: row.product_id,
          change_qty: -row.quantity,
          reason: 'order',
          order_id: order.id,
        });
      }
    }

    await orderRepository.insertStatusHistory(transaction, { order_id: order.id, status: 'NEW' });

    if (promo) {
      await promoRepository.insertUsageTx(transaction, { promo_code_id: promo.id, order_id: order.id, discount_amount: discount });
      await promoRepository.incrementUsageTx(transaction, promo.id);
    }

    await transaction.commit();

    const fullOrder = { ...order, items: priceRows, table_code: table?.code };
    stockUpdatedProducts.forEach((p) => emitProductUpdated(p, 'updated'));

    // Onlayn ödənişli sifariş ödəniş təsdiqlənəndə (paymentService) elan olunur — o vaxta qədər admin/mətbəx görmür
    if (method !== 'ONLINE') await announceOrder(fullOrder, { table, stockUpdatedProducts });
    return fullOrder;
  } catch (err) {
    if (transaction) {
      try {
        await transaction.rollback();
      } catch (rollbackErr) {
        console.error('Rollback xətası:', rollbackErr);
      }
    }
    if (client_request_id && isUniqueViolation(err)) {
      const raced = await findReplay(pool, client_request_id, phone);
      if (raced) return raced;
    }
    throw err;
  }
}

// Sifarişi adminlərə/mətbəxə çatdırır: socket + bildiriş (+ stok xəbərdarlıqları). Commit-dən SONRA çağırılır — xəta müştəriyə 500 kimi qayıtmır.
async function announceOrder(order, { table, stockUpdatedProducts = [] } = {}) {
  emitOrderCreated(order);
  try {
    const items = order.items || [];
    await notificationService.create({
      type: 'order_created',
      title: table ? `Yeni sifariş — ${table.label}` : 'Yeni sifariş',
      body: `${items.reduce((n, r) => n + Number(r.quantity), 0)} məhsul · ${Number(order.total).toFixed(2)} ₼${order.payment_status === 'PAID' ? ' · ödənilib' : ''}`,
      entity_type: 'order',
      entity_id: order.id,
    });
    for (const product of stockUpdatedProducts) {
      const ordered = items.find((r) => r.product_id === product.id)?.quantity || 0;
      await notifyStockLevel(product, ordered);
    }
  } catch (notifyErr) {
    console.error('Bildiriş yaradıla bilmədi:', notifyErr.message);
  }
}

// Ödəniş təsdiqləndikdən sonra: sifarişi DB-dən oxuyub elan edir
async function announceStoredOrder(orderId) {
  const pool = await poolPromise;
  const order = await orderRepository.findById(pool, orderId);
  if (!order) return;
  const table = order.table_id ? await tableRepository.findById(order.table_id) : null;
  await announceOrder({ ...order, table_code: table?.code }, { table });
}

async function getOrder(id, { isAdmin, token } = {}) {
  const pool = await poolPromise;
  const order = await orderRepository.findById(pool, id);
  if (!order) throw new AppError(404, 'Sifariş tapılmadı');
  if (!isAdmin && order.access_token !== token) {
    throw new AppError(404, 'Sifariş tapılmadı');
  }
  if (!isAdmin) delete order.access_token;
  return order;
}

// Socket otağına qoşulma icazəsi: sifarişin gizli tokeni (sabit vaxtda müqayisə)
async function hasAccess(id, token) {
  const pool = await poolPromise;
  const expected = await orderRepository.findAccessToken(pool, id);
  if (!expected || typeof token !== 'string') return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(token);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function listOrders(filters) {
  const pool = await poolPromise;
  return orderRepository.findAll(pool, filters);
}

async function updateStatus(id, status, adminId, note) {
  const pool = await poolPromise;
  // Onlayn ödənişi təsdiqlənməyən sifariş hazırlanmağa göndərilə bilməz (yalnız ləğv edilə bilər)
  const current = await orderRepository.findById(pool, id);
  if (current && current.payment_method === 'ONLINE' && ['PENDING', 'FAILED'].includes(current.payment_status) && status !== 'CANCELLED') {
    throw new AppError(409, 'Onlayn ödəniş hələ təsdiqlənməyib — sifariş yalnız ləğv edilə bilər');
  }
  let transaction;
  try {
    transaction = new sql.Transaction(pool);
    await transaction.begin();

    const order = await orderRepository.updateStatus(transaction, id, status);
    if (!order) throw new AppError(404, 'Sifariş tapılmadı');

    await orderRepository.insertStatusHistory(transaction, { order_id: id, status, changed_by: adminId, note });

    await transaction.commit();
    emitOrderStatusUpdated(order);
    return order;
  } catch (err) {
    if (transaction) {
      try {
        await transaction.rollback();
      } catch (rollbackErr) {
        console.error('Rollback xətası:', rollbackErr);
      }
    }
    throw err;
  }
}

module.exports = { createOrder, quote, getOrder, hasAccess, listOrders, updateStatus, announceStoredOrder, enabledPaymentMethods, resolvePaymentMethod, PAYMENT_METHODS };
