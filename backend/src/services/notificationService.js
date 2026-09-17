const notificationRepository = require('../repositories/notificationRepository');
const AppError = require('../utils/AppError');
const { emitNotificationCreated } = require('../sockets/emit');

const DEFAULT_RESTAURANT_ID = 1;

async function create({ type, title, body, entity_type, entity_id }) {
  const notification = await notificationRepository.create({
    restaurant_id: DEFAULT_RESTAURANT_ID,
    type,
    title,
    body,
    entity_type,
    entity_id,
  });
  emitNotificationCreated(notification);
  return notification;
}

async function list(filters) {
  return notificationRepository.findAll(filters);
}

async function markRead(id) {
  const notification = await notificationRepository.markRead(id);
  if (!notification) throw new AppError(404, 'Bildiriş tapılmadı');
  return notification;
}

async function markAllRead() {
  await notificationRepository.markAllRead();
}

module.exports = { create, list, markRead, markAllRead };
