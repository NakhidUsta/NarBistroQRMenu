let ioInstance = null;

function setIO(io) {
  ioInstance = io;
}

function getIO() {
  if (!ioInstance) {
    throw new Error('Socket.io hələ başladılmayıb');
  }
  return ioInstance;
}

// Sessiyası ləğv edilən adminin açıq socket bağlantılarını qapat (yenidən qoşulmaq üçün etibarlı cookie tələb olunacaq).
function disconnectAdmin(userId) {
  if (!ioInstance) return;
  ioInstance.of('/admin').in(`user:${userId}`).disconnectSockets(true);
}

function emitProductUpdated(product, action) {
  getIO().emit('product-updated', { product, action });
  getIO().of('/admin').to('admin').emit('product-updated', { product, action });
}

function emitCategoryUpdated(category, action) {
  getIO().emit('category-updated', { category, action });
  getIO().of('/admin').to('admin').emit('category-updated', { category, action });
}

function emitIngredientUpdated(ingredient, action) {
  getIO().emit('ingredient-updated', { ingredient, action });
  getIO().of('/admin').to('admin').emit('ingredient-updated', { ingredient, action });
}

function emitTableUpdated(table, action) {
  getIO().of('/admin').to('admin').emit('table-updated', { table, action });
}

function emitOrderCreated(order) {
  getIO().of('/admin').to('admin').emit('order-created', order);
  if (order.table_code) {
    getIO().to(`table:${order.table_code}`).emit('order-created', order);
  }
}

function emitOrderStatusUpdated(order) {
  getIO().of('/admin').to('admin').emit('order-status-updated', order);
  getIO().to(`order:${order.id}`).emit('order-status-updated', order);
}

function emitRestaurantUpdated(restaurant) {
  getIO().emit('restaurant-updated', restaurant);
}

// Sistem xətaları yalnız sahib/menecerə (bax: notificationService.RESTRICTED_TYPES), qalanları bütün adminlərə
function adminTargets(notification) {
  const admins = getIO().of('/admin');
  return notification.type === 'system_error' ? admins.to('role:OWNER').to('role:MANAGER') : admins.to('admin');
}

function emitNotificationCreated(notification) {
  adminTargets(notification).emit('notification-created', notification);
}

function emitNotificationUpdated(notification) {
  adminTargets(notification).emit('notification-updated', notification);
}

module.exports = {
  setIO,
  getIO,
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
};
