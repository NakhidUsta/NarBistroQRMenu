const notificationService = require('../services/notificationService');
const auditService = require('../services/auditService');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { parsePage, sendPage } = require('../utils/pagination');

const validId = (value) => {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new AppError(400, 'Yanlış bildiriş ID-si');
  return id;
};

exports.getAllNotifications = asyncHandler(async (req, res) => {
  const { limit, before } = parsePage(req.query);
  const rows = await notificationService.list({ unreadOnly: req.query.unreadOnly === 'true', role: req.admin.role, limit: limit + 1, before });
  res.json(sendPage(res, rows, limit));
});

exports.markRead = asyncHandler(async (req, res) => {
  res.json(await notificationService.markRead(validId(req.params.id)));
});

// Call Waiter / Request Bill: [Qəbul et] → ACCEPTED, [Həll edildi] → RESOLVED
exports.setStatus = asyncHandler(async (req, res) => {
  const id = validId(req.params.id);
  const { status } = req.body;
  if (!['ACCEPTED', 'RESOLVED'].includes(status)) throw new AppError(400, 'status ACCEPTED və ya RESOLVED olmalıdır');
  const { previous, notification } = await notificationService.setStatus(id, status, req.admin.id);
  await auditService.log(req, 'notification.status', 'notifications', id, { status: previous }, { status: notification.status });
  res.json(notification);
});

exports.remove = asyncHandler(async (req, res) => {
  await notificationService.remove(validId(req.params.id));
  res.status(204).send();
});

exports.removeAllRead = asyncHandler(async (req, res) => {
  await notificationService.removeAllRead();
  res.status(204).send();
});

exports.markAllRead = asyncHandler(async (req, res) => {
  await notificationService.markAllRead();
  res.status(204).send();
});
