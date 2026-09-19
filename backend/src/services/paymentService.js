const crypto = require('crypto');
const { sql, poolPromise } = require('../config/db');
const paymentsConfig = require('../config/payments');
const orderRepository = require('../repositories/orderRepository');
const paymentRepository = require('../repositories/paymentRepository');
const orderService = require('./orderService');
const systemAlertService = require('./systemAlertService');
const { getProvider, PROVIDERS } = require('./payments');
const AppError = require('../utils/AppError');
const { emitOrderStatusUpdated, emitProductUpdated } = require('../sockets/emit');

const MANUAL_METHODS = ['CASH', 'CARD_POS'];
const amountsMatch = (a, b) => Math.abs(Number(a) - Number(b)) <= 0.005;

async function rollbackQuietly(tx) {
  if (!tx) return;
  try {
    await tx.rollback();
  } catch {
    // tranzaksiya artıq bağlanıb
  }
}

// Müştəriyə görünən sifariş (gizli token çıxarılır)
const publicOrder = (order) => {
  const { access_token: _token, ...rest } = order;
  return rest;
};

// ---------- Onlayn ödənişin başladılması ----------

async function startOnlinePayment(orderId, token, { language } = {}) {
  if (!(await orderService.hasAccess(orderId, token))) throw new AppError(404, 'Sifariş tapılmadı');
  const pool = await poolPromise;
  const order = await orderRepository.findById(pool, orderId);
  if (!order) throw new AppError(404, 'Sifariş tapılmadı');
  if (order.payment_method !== 'ONLINE') throw new AppError(409, 'Bu sifariş onlayn ödəniş üçün deyil');
  if (order.payment_status === 'PAID') throw new AppError(409, 'Sifariş artıq ödənilib');
  if (order.status === 'CANCELLED') throw new AppError(409, 'Sifariş ləğv edilib — yeni sifariş verin');
  if (order.payment_status === 'REFUNDED') throw new AppError(409, 'Bu sifarişin ödənişi geri qaytarılıb');

  const provider = getProvider();
  if (!provider) throw new AppError(503, 'Onlayn ödəniş hazırda mövcud deyil');

  // Cəhd başına unikal ID: provayderə göndərilir, callback bu ID ilə cəhdi tapır
  const providerOrderId = `o${order.id}-${crypto.randomBytes(5).toString('hex')}`;
  // Məbləğ HƏMİŞƏ DB-dəki sifariş məbləğidir — müştərinin göndərdiyi heç nəyə güvənilmir
  const payment = await paymentRepository.create(pool, {
    order_id: order.id,
    provider: provider.name,
    method: 'ONLINE',
    amount: order.total,
    currency: order.currency,
    provider_order_id: providerOrderId,
  });

  const { publicUrl, apiPublicUrl } = paymentsConfig.get();
  const returnBase = `${publicUrl}/order/${order.id}?token=${order.access_token}`;
  try {
    const { redirectUrl, transaction } = await provider.createPayment({
      providerOrderId,
      amount: Number(order.total),
      currency: order.currency,
      description: `Sifariş #${order.id}`,
      language,
      successUrl: `${returnBase}&pay=success`,
      errorUrl: `${returnBase}&pay=error`,
      resultUrl: `${apiPublicUrl}/api/payments/epoint/callback`,
    });
    if (transaction) await paymentRepository.update(pool, payment.id, { provider_transaction: transaction });
    return { redirect_url: redirectUrl, payment_id: payment.id };
  } catch (err) {
    await paymentRepository.update(pool, payment.id, { status: 'FAILED', failure_reason: err.message });
    console.error('Ödəniş başladıla bilmədi:', err.message);
    systemAlertService.report('payment-start', 'Onlayn ödəniş başlamadı', `Sifariş #${order.id}: ${err.message}`).catch(() => {});
    throw new AppError(502, 'Ödəniş səhifəsi açıla bilmədi, bir az sonra yenidən cəhd edin');
  }
}

// ---------- Provayder nəticəsinin tətbiqi (callback / status sorğusu / sınaq səhifəsi) ----------

// result: { providerOrderId, status: 'success'|'failed'|'refunded'|'pending', transaction, amount, cardMask, message }
// İdempotentdir: eyni nəticə təkrar gəlsə (provayderlər callback-i təkrarlayır) heç nə dəyişmir.
async function applyProviderResult(result) {
  if (!result?.providerOrderId) throw new AppError(400, 'Ödəniş ID-si yoxdur');
  const pool = await poolPromise;
  const known = await paymentRepository.findByProviderOrderId(pool, result.providerOrderId);
  if (!known) throw new AppError(404, 'Ödəniş tapılmadı');
  if (result.status === 'pending') return { changed: false, orderId: known.order_id };

  let tx;
  let outcome;
  try {
    tx = new sql.Transaction(pool);
    await tx.begin();
    const payment = await paymentRepository.findByProviderOrderIdForUpdate(tx, result.providerOrderId);

    if (result.status === 'success') {
      if (payment.status === 'SUCCESS') {
        await tx.commit();
        return { changed: false, orderId: payment.order_id };
      }
      // Məbləğ uyğun deyilsə (saxtakarlıq/səhv) ödəniş TƏSDİQLƏNMİR
      if (result.amount != null && !amountsMatch(result.amount, payment.amount)) {
        await tx.rollback();
        systemAlertService.report('payment-amount', 'Ödəniş məbləği uyğun deyil', `Ödəniş #${payment.id} (sifariş #${payment.order_id}): gözlənilən ${payment.amount}, gələn ${result.amount}`).catch(() => {});
        throw new AppError(400, 'Ödəniş məbləği uyğun deyil');
      }
      await paymentRepository.update(tx, payment.id, { status: 'SUCCESS', provider_transaction: result.transaction, card_mask: result.cardMask, paid_at: new Date() });
      const order = await orderRepository.setPaymentTx(tx, payment.order_id, {
        payment_status: 'PAID',
        paid_at: new Date(),
        paid_amount: payment.amount,
        allowedFrom: ['PENDING', 'FAILED', 'UNPAID'],
      });
      await tx.commit();
      outcome = { changed: !!order, orderId: payment.order_id, order, kind: 'paid' };
    } else if (result.status === 'failed') {
      if (payment.status !== 'PENDING') {
        await tx.commit();
        return { changed: false, orderId: payment.order_id };
      }
      await paymentRepository.update(tx, payment.id, { status: 'FAILED', provider_transaction: result.transaction, failure_reason: result.message || 'Ödəniş alınmadı' });
      // Başqa cəhd artıq uğurlu olubsa (PAID) sifarişin statusuna toxunulmur
      const order = await orderRepository.setPaymentTx(tx, payment.order_id, { payment_status: 'FAILED', allowedFrom: ['PENDING'] });
      await tx.commit();
      outcome = { changed: true, orderId: payment.order_id, order, kind: 'failed' };
    } else if (result.status === 'refunded') {
      if (payment.status !== 'SUCCESS') {
        await tx.commit();
        return { changed: false, orderId: payment.order_id };
      }
      await paymentRepository.update(tx, payment.id, { status: 'REFUNDED' });
      const order = await orderRepository.setPaymentTx(tx, payment.order_id, { payment_status: 'REFUNDED', allowedFrom: ['PAID'] });
      await tx.commit();
      outcome = { changed: true, orderId: payment.order_id, order, kind: 'refunded' };
    } else {
      await tx.commit();
      return { changed: false, orderId: payment.order_id };
    }
  } catch (err) {
    await rollbackQuietly(tx);
    throw err;
  }

  if (outcome.order) {
    emitOrderStatusUpdated(outcome.order);
    if (outcome.kind === 'paid') await afterPaid(outcome.order);
  }
  return outcome;
}

// Ödəniş təsdiqləndi: onlayn sifariş İLK DƏFƏ indi adminə/mətbəxə çatır
async function afterPaid(order) {
  if (order.status === 'CANCELLED') {
    // Ödəniş vaxt keçəndən sonra gəlib, sifariş artıq ləğv olunub — pul qəbul edilib, işçi geri qaytarmalıdır
    systemAlertService.report(`late-payment-${order.id}`, 'Ləğv olunmuş sifariş üçün ödəniş gəldi', `Sifariş #${order.id} ləğv edilmişdi, lakin ${order.paid_amount} ${order.currency} ödənilib — məbləği geri qaytarın.`).catch(() => {});
    return;
  }
  if (order.payment_method === 'ONLINE') await orderService.announceStoredOrder(order.id);
}

// ---------- Endpoint-lər üçün ----------

async function handleEpointCallback({ data, signature }) {
  const provider = PROVIDERS.epoint;
  const parsed = provider.parseCallback({ data, signature });
  if (!parsed.valid) throw new AppError(400, 'İmza etibarsızdır');
  return applyProviderResult(parsed.result);
}

// Müştəri ödəniş səhifəsindən qayıdanda: callback gecikibsə provayderdən statusu özümüz soruşuruq
async function verifyOrderPayment(orderId, token) {
  if (!(await orderService.hasAccess(orderId, token))) throw new AppError(404, 'Sifariş tapılmadı');
  const pool = await poolPromise;
  const order = await orderRepository.findById(pool, orderId);
  if (order?.payment_method === 'ONLINE' && ['PENDING', 'FAILED'].includes(order.payment_status)) {
    const provider = getProvider();
    if (provider) {
      const attempts = await paymentRepository.findPendingWithTransaction(pool, orderId);
      for (const attempt of attempts.slice(0, 3)) {
        try {
          const result = await provider.fetchStatus({ transaction: attempt.provider_transaction });
          if (result && result.status !== 'pending') {
            await applyProviderResult({ ...result, providerOrderId: attempt.provider_order_id });
            if (result.status === 'success') break;
          }
        } catch (err) {
          console.error('Ödəniş statusu yoxlanıla bilmədi:', err.message);
        }
      }
    }
  }
  return publicOrder(await orderRepository.findById(pool, orderId));
}

// Sınaq provayderi: saxta ödəniş səhifəsində "Uğurlu/Uğursuz". Production-da ƏLÇATMAZDIR.
async function completeTestPayment({ providerOrderId, sig, outcome }) {
  const test = PROVIDERS.test;
  if (process.env.NODE_ENV === 'production' || getProvider() !== test) throw new AppError(404, 'Tapılmadı');
  if (!test.verifySig(providerOrderId, sig)) throw new AppError(403, 'İmza etibarsızdır');
  const pool = await poolPromise;
  const payment = await paymentRepository.findByProviderOrderId(pool, providerOrderId);
  if (!payment) throw new AppError(404, 'Ödəniş tapılmadı');
  const result = await applyProviderResult({
    providerOrderId,
    status: outcome === 'success' ? 'success' : 'failed',
    transaction: `test-${providerOrderId}`,
    amount: Number(payment.amount),
    cardMask: outcome === 'success' ? '411111******1111' : null,
    message: outcome === 'success' ? null : 'Sınaq: ödəniş rədd edildi',
  });
  const order = await orderRepository.findById(pool, payment.order_id);
  return { order_id: order.id, access_token: order.access_token, payment_status: order.payment_status, result };
}

// Nağd / kartla masada: işçi ödənişi "alındı" kimi qeyd edir
async function markPaidManually(orderId, adminId, method) {
  const pool = await poolPromise;
  const order = await orderRepository.findById(pool, orderId);
  if (!order) throw new AppError(404, 'Sifariş tapılmadı');
  if (order.payment_method === 'ONLINE') throw new AppError(409, 'Onlayn ödəniş provayder tərəfindən təsdiqlənir — əllə qeyd edilə bilməz');
  if (order.payment_status === 'PAID') throw new AppError(409, 'Sifariş artıq ödənilib');
  if (order.status === 'CANCELLED') throw new AppError(409, 'Ləğv olunmuş sifariş üçün ödəniş qeyd edilə bilməz');
  const finalMethod = method || order.payment_method;
  if (!MANUAL_METHODS.includes(finalMethod)) throw new AppError(400, 'Ödəniş üsulu NAĞD və ya KART olmalıdır');

  let tx;
  try {
    tx = new sql.Transaction(pool);
    await tx.begin();
    await paymentRepository.create(tx, {
      order_id: order.id,
      provider: 'manual',
      method: finalMethod,
      status: 'SUCCESS',
      amount: order.total,
      currency: order.currency,
      created_by: adminId,
      paid_at: new Date(),
    });
    const updated = await orderRepository.setPaymentTx(tx, order.id, {
      payment_status: 'PAID',
      payment_method: finalMethod,
      paid_at: new Date(),
      paid_amount: order.total,
      allowedFrom: ['UNPAID'],
    });
    if (!updated) throw new AppError(409, 'Sifariş artıq ödənilib');
    await tx.commit();
    emitOrderStatusUpdated(updated);
    return { before: order, order: updated };
  } catch (err) {
    await rollbackQuietly(tx);
    throw err;
  }
}

async function listPayments(orderId) {
  const pool = await poolPromise;
  return paymentRepository.listByOrder(pool, orderId);
}

// ---------- Vaxtı keçmiş ödənilməmiş onlayn sifarişlər ----------

// Ödənilməyən onlayn sifariş stoku sonsuz bloklamasın: HOLD dəqiqədən sonra ləğv edilir, stok qaytarılır.
async function expireUnpaidOnlineOrders() {
  const pool = await poolPromise;
  const ids = await orderRepository.findExpiredUnpaidOnline(pool, paymentsConfig.get().holdMinutes);
  let expired = 0;
  for (const id of ids) {
    let tx;
    try {
      tx = new sql.Transaction(pool);
      await tx.begin();
      const order = await orderRepository.updateStatus(tx, id, 'CANCELLED');
      await orderRepository.insertStatusHistory(tx, { order_id: id, status: 'CANCELLED', note: 'Onlayn ödəniş vaxtında edilmədi' });
      const restored = [];
      for (const item of await orderRepository.findItemsTx(tx, id)) {
        const product = await orderRepository.restoreStockTx(tx, item.product_id, item.quantity);
        if (product) {
          restored.push(product);
          await orderRepository.insertStockMovementTx(tx, { product_id: item.product_id, change_qty: item.quantity, reason: 'order_expired', order_id: id });
        }
      }
      await paymentRepository.failOpenForOrder(tx, id, 'Ödəniş vaxtı bitdi');
      await tx.commit();
      expired += 1;
      if (order) emitOrderStatusUpdated(order);
      restored.forEach((p) => emitProductUpdated(p, 'updated'));
    } catch (err) {
      await rollbackQuietly(tx);
      console.error(`Vaxtı keçmiş sifariş #${id} ləğv edilə bilmədi:`, err.message);
    }
  }
  return expired;
}

let sweeper = null;
function startExpirySweeper(intervalMs = 5 * 60 * 1000) {
  if (sweeper) return sweeper;
  sweeper = setInterval(() => expireUnpaidOnlineOrders().catch((err) => console.error('Ödəniş təmizləmə xətası:', err.message)), intervalMs);
  sweeper.unref?.();
  return sweeper;
}

module.exports = {
  startOnlinePayment,
  applyProviderResult,
  handleEpointCallback,
  verifyOrderPayment,
  completeTestPayment,
  markPaidManually,
  listPayments,
  expireUnpaidOnlineOrders,
  startExpirySweeper,
};
