const notificationService = require('../services/notificationService');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');

exports.getAllNotifications = asyncHandler(async (req, res) => {
  res.json(await notificationService.list({ unreadOnly: req.query.unreadOnly === 'true' }));
});

exports.markRead = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new AppError(400, 'Yanlış bildiriş ID-si');
  res.json(await notificationService.markRead(id));
});

exports.remove = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new AppError(400, 'Yanlış bildiriş ID-si');
  await notificationService.remove(id);
  res.status(204).send();
});

exports.removeAllRead = asyncHandler(async (req, res) => {
  await notificationService.removeAllRead();
  res.status(204).send();
});

exports.markAllRead =asyncHandler(async (req, res) => {
  await notificationService.markAllRead();
  res.status(204).send();
});
