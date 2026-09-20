const paymentService = require('../services/paymentService');
const auditService = require('../services/auditService');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');

const orderIdOf = (req) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new AppError(400, 'Yanlış sifariş ID-si');
  return id;
};
const tokenOf = (req) => {
  const token = req.body?.token;
  if (typeof token !== 'string' || token.length < 8 || token.length > 128) throw new AppError(400, 'Sifariş tokeni tələb olunur');
  return token;
};

// Müştəri: onlayn ödənişi başlat → provayderin ödəniş səhifəsinin ünvanı
exports.start = asyncHandler(async (req, res) => {
  const language = ['az', 'en', 'ru'].includes(req.body?.language) ? req.body.language : 'az';
  res.json(await paymentService.startOnlinePayment(orderIdOf(req), tokenOf(req), { language }));
});

// Müştəri: ödəniş səhifəsindən qayıdıb — statusu yoxla (callback gecikə bilər)
exports.verify = asyncHandler(async (req, res) => {
  res.json(await paymentService.verifyOrderPayment(orderIdOf(req), tokenOf(req)));
});

// Epoint server-server bildirişi: imza yoxlanılır, yalnız sonra emal olunur. Təkrar gəlişlərə dözümlüdür.
exports.epointCallback = asyncHandler(async (req, res) => {
  const { data, signature } = req.body || {};
  await paymentService.handleEpointCallback({ data, signature });
  res.status(200).send('ok');
});

// Yalnız PAYMENT_PROVIDER=test və production olmayanda
exports.testComplete = asyncHandler(async (req, res) => {
  const { o, sig, outcome } = req.body || {};
  if (typeof o !== 'string' || typeof sig !== 'string' || !['success', 'failed'].includes(outcome)) throw new AppError(400, 'Yanlış sorğu');
  res.json(await paymentService.completeTestPayment({ providerOrderId: o, sig, outcome }));
});

// Admin/ofisiant: nağd və ya kartla masada ödənişi "alındı" kimi qeyd et
exports.markPaid = asyncHandler(async (req, res) => {
  const id = orderIdOf(req);
  const method = req.body?.method;
  if (method != null && !['CASH', 'CARD_POS'].includes(method)) throw new AppError(400, 'Ödəniş üsulu NAĞD və ya KART olmalıdır');
  const { before, order } = await paymentService.markPaidManually(id, req.admin.id, method);
  await auditService.log(req, 'order.payment', 'orders', id, { payment_status: before.payment_status, payment_method: before.payment_method }, { payment_status: order.payment_status, payment_method: order.payment_method, amount: order.paid_amount });
  res.json(order);
});

// OWNER/MANAGER: onlayn ödənişi tam geri qaytar (Epoint "reverse")
exports.refund = asyncHandler(async (req, res) => {
  const id = orderIdOf(req);
  const { before, order } = await paymentService.refundOrder(id, req.admin.id);
  await auditService.log(req, 'order.refund', 'orders', id, { payment_status: before.payment_status }, { payment_status: order.payment_status, amount: before.paid_amount });
  res.json(order);
});

exports.list = asyncHandler(async (req, res) => {
  res.json(await paymentService.listPayments(orderIdOf(req)));
});
