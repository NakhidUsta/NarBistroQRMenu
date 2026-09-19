const notificationRepository = require('../repositories/notificationRepository');
const AppError = require('../utils/AppError');
const { emitNotificationCreated, emitNotificationUpdated } = require('../sockets/emit');

const DEFAULT_RESTAURANT_ID = 1;
const HANDLEABLE_TYPES = ['call_waiter', 'request_bill'];
// OPEN → ACCEPTED → RESOLVED (OPEN-dən birbaşa RESOLVED də olar); həll olunmuş sorğu geri açılmır
const TRANSITIONS = { OPEN: ['ACCEPTED', 'RESOLVED'], ACCEPTED: ['RESOLVED'], RESOLVED: [] };
// Texniki xətalar yalnız sahib/menecerə göstərilir (ofisiant/mətbəx sistem detallarını görməsin)
const RESTRICTED_TYPES = { WAITER: ['system_error'] };

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

// Çağırış/hesab sorğusu: masada artıq həll olunmamış eyni sorğu varsa ikinci bildiriş yaranmır
async function createOnce(data) {
  const existing = await notificationRepository.findUnresolved(data.type, data.entity_type, data.entity_id);
  return existing || create(data);
}

async function list({ unreadOnly, role, limit, before } = {}) {
  return notificationRepository.findAll({ unreadOnly, excludeTypes: RESTRICTED_TYPES[role] || [], limit, before });
}

async function markRead(id) {
  const notification = await notificationRepository.markRead(id);
  if (!notification) throw new AppError(404, 'Bildiriş tapılmadı');
  return notification;
}

async function setStatus(id, status, adminId) {
  const current = await notificationRepository.findById(id);
  if (!current) throw new AppError(404, 'Bildiriş tapılmadı');
  if (!HANDLEABLE_TYPES.includes(current.type)) throw new AppError(400, 'Bu bildiriş növü üçün status dəyişmək olmaz');
  if (!TRANSITIONS[current.status]?.includes(status)) {
    throw new AppError(409, current.status === 'RESOLVED' ? 'Bu sorğu artıq həll olunub' : `Statusu ${current.status} → ${status} dəyişmək olmaz`);
  }
  const updated = await notificationRepository.setStatus(id, status, adminId);
  emitNotificationUpdated(updated);
  return { previous: current.status, notification: updated };
}

async function markAllRead() {
  await notificationRepository.markAllRead();
}

async function remove(id) {
  if (!(await notificationRepository.remove(id))) throw new AppError(404, 'Bildiriş tapılmadı');
}

async function removeAllRead() {
  await notificationRepository.removeAllRead();
}

module.exports = { create, createOnce, list, markRead, setStatus, markAllRead, remove, removeAllRead, HANDLEABLE_TYPES, TRANSITIONS, RESTRICTED_TYPES };
