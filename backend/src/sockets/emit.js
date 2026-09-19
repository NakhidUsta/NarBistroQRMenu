const crypto = require('crypto');
const logger = require('../utils/logger');

let ioInstance = null;

// Hadisə etibarlılığı:
//  • hər hadisəyə unikal `_eid` əlavə olunur — klient eyni hadisəni ikinci dəfə (məs. bağlantı bərpasında təkrar çatdırılma) alsa atır;
//  • kritik hadisələr (sifariş, bildiriş) `_ack: true` daşıyır — klient alınca `event-ack` mesajı ilə təsdiq göndərir.
//    Təsdiq gözləyən server ACK_TIMEOUT_MS ərzində gözlənilən sayda cavab almazsa statistikada və jurnalda qeyd edir.
//  Niyə socket.io-nun daxili callback-ack-ı yox: ack tələb edən hadisələr "connectionStateRecovery" buferində saxlanılmır,
//  yəni qısa kəsilmədə itən sifariş hadisəsi bərpa zamanı təkrar göndərilməzdi. Ayrıca mesajla təsdiq bunu qoruyur.
const ACK_TIMEOUT_MS = Number(process.env.SOCKET_ACK_TIMEOUT_MS) || 5000;
const stats = { critical_sent: 0, acked_all: 0, missing_ack: 0 };
const pending = new Map(); // eid → { event, expected, acks }

function setIO(io) {
  ioInstance = io;
}

function getIO() {
  if (!ioInstance) {
    throw new Error('Socket.io hələ başladılmayıb');
  }
  return ioInstance;
}

// Klientdən gələn təsdiq (sockets/index.js hər iki namespace-də çağırır)
function recordAck(eid) {
  const entry = typeof eid === 'string' ? pending.get(eid) : null;
  if (entry) entry.acks += 1;
}

function trackAck(target, event, eid) {
  stats.critical_sent += 1;
  const entry = { event, expected: null, acks: 0 };
  pending.set(eid, entry);
  // gözlənilən alıcı sayı (otaqdakı bağlı socket-lər); alınmasa 0 hesab olunur (kimsə onlayn deyil — itirilən bir şey yoxdur)
  Promise.resolve(target.fetchSockets()).then((list) => { entry.expected = list.length; }).catch(() => { entry.expected = 0; });
  const timer = setTimeout(() => {
    pending.delete(eid);
    if (entry.expected !== null && entry.acks < entry.expected) {
      stats.missing_ack += 1;
      logger.warn(`Socket hadisəsi (${event}) bəzi klientlərdən təsdiq almadı (${entry.acks}/${entry.expected})`, { event, eid });
    } else {
      stats.acked_all += 1;
    }
  }, ACK_TIMEOUT_MS);
  timer.unref();
}

const withEnvelope = (payload, critical) => ({ ...payload, _eid: crypto.randomUUID(), ...(critical && { _ack: true }) });

// target — namespace/room (BroadcastOperator). critical=true → klient təsdiqi izlənilir.
function send(target, event, payload, { critical = false } = {}) {
  const data = withEnvelope(payload, critical);
  target.emit(event, data);
  if (critical) trackAck(target, event, data._eid);
}

function getSocketStats() {
  const io = ioInstance;
  return {
    public_clients: io ? io.of('/').sockets.size : 0,
    admin_clients: io ? io.of('/admin').sockets.size : 0,
    ...stats,
  };
}

// Sessiyası ləğv edilən adminin açıq socket bağlantılarını qapat (yenidən qoşulmaq üçün etibarlı cookie tələb olunacaq).
function disconnectAdmin(userId) {
  if (!ioInstance) return;
  ioInstance.of('/admin').in(`user:${userId}`).disconnectSockets(true);
}

const admins = () => getIO().of('/admin');

function emitProductUpdated(product, action) {
  send(getIO(), 'product-updated', { product, action });
  send(admins().to('admin'), 'product-updated', { product, action });
}

function emitCategoryUpdated(category, action) {
  send(getIO(), 'category-updated', { category, action });
  send(admins().to('admin'), 'category-updated', { category, action });
}

function emitIngredientUpdated(ingredient, action) {
  send(getIO(), 'ingredient-updated', { ingredient, action });
  send(admins().to('admin'), 'ingredient-updated', { ingredient, action });
}

function emitTableUpdated(table, action) {
  send(admins().to('admin'), 'table-updated', { table, action });
}

// Müştəri otaqlarına (table:/order:) telefon, ad, giriş tokeni kimi şəxsi sahələr GÖNDƏRİLMİR — yalnız minimal məlumat.
function emitOrderCreated(order) {
  send(admins().to('admin'), 'order-created', order, { critical: true });
  if (order.table_code) {
    send(getIO().to(`table:${order.table_code}`), 'order-created', { id: order.id, status: order.status, table_code: order.table_code });
  }
}

function emitOrderStatusUpdated(order) {
  send(admins().to('admin'), 'order-status-updated', order, { critical: true });
  send(getIO().to(`order:${order.id}`), 'order-status-updated', { id: order.id, status: order.status }, { critical: true });
}

function emitRestaurantUpdated(restaurant) {
  send(getIO(), 'restaurant-updated', restaurant);
}

// Sistem xətaları yalnız sahib/menecerə (bax: notificationService.RESTRICTED_TYPES), qalanları bütün adminlərə
function adminTargets(notification) {
  return notification.type === 'system_error' ? admins().to('role:OWNER').to('role:MANAGER') : admins().to('admin');
}

function emitNotificationCreated(notification) {
  send(adminTargets(notification), 'notification-created', notification, { critical: true });
}

function emitNotificationUpdated(notification) {
  send(adminTargets(notification), 'notification-updated', notification);
}

module.exports = {
  setIO,
  getIO,
  getSocketStats,
  recordAck,
  disconnectAdmin,
  emitProductUpdated,
  emitCategoryUpdated,
  emitIngredientUpdated,
  emitTableUpdated,
  emitOrderCreated,
  emitOrderStatusUpdated,
  emitRestaurantUpdated,
  emitNotificationCreated,
  emitNotificationUpdated,
  ACK_TIMEOUT_MS,
};
