const crypto = require('crypto');
const { sql, poolPromise } = require('../config/db');
const orderRepository = require('../repositories/orderRepository');
const tableRepository = require('../repositories/tableRepository');
const promoRepository = require('../repositories/promoRepository');
const notificationService = require('./notificationService');
const promoService = require('./promoService');
const AppError = require('../utils/AppError');
const { emitOrderCreated, emitOrderStatusUpdated, emitProductUpdated } = require('../sockets/emit');

const DEFAULT_RESTAURANT_ID = 1;

async function createOrder({ table_code, customer_name, phone, note, items, promo_code }) {
  const pool = await poolPromise;
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
      if (!product.is_available) throw new AppError(400, `Məhsul hazırda mövcud deyil: ${item.product_id}`);

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
    const total = Math.max(0, subtotal - discount);

    const order = await orderRepository.insertOrder(transaction, {
      restaurant_id: DEFAULT_RESTAURANT_ID,
      table_id: table?.id,
      table_session_id: null,
      customer_name,
      phone,
      note,
      subtotal,
      discount,
      total,
      promo_code_id: promo?.id,
      promo_code: promo?.code,
      access_token: crypto.randomBytes(16).toString('hex'),
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
    emitOrderCreated(fullOrder);
    stockUpdatedProducts.forEach((p) => emitProductUpdated(p, 'updated'));
    await notificationService.create({
      type: 'order_created',
      title: table ? `Yeni sifariş — ${table.label}` : 'Yeni sifariş',
      body: `${priceRows.reduce((n, r) => n + r.quantity, 0)} məhsul · ${total.toFixed(2)} ₼`,
      entity_type: 'order',
      entity_id: order.id,
    });

    return fullOrder;
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

async function listOrders(filters) {
  const pool = await poolPromise;
  return orderRepository.findAll(pool, filters);
}

async function updateStatus(id, status, adminId, note) {
  const pool = await poolPromise;
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

module.exports = { createOrder, getOrder, listOrders, updateStatus };
