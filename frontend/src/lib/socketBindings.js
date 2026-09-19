import { publicSocket, adminSocket } from './socket'
import { alreadySeen } from './eventDedupe'
import { useMenuStore } from '../store/menuStore'
import { useOrderStore } from '../store/orderStore'
import { useNotificationStore } from '../store/notificationStore'
import { useRestaurantStore } from '../store/restaurantStore'
import { playAlert, browserNotify } from './alerts'

let publicBound = false
let adminBound = false

// Hadisə dinləyicisi: (1) `_ack` işarəli kritik hadisələr serverə təsdiq göndərir, (2) təkrar gələn hadisə (eyni `_eid`)
// atılır, (3) handler-ə servis sahələri (`_eid`, `_ack`) olmadan təmiz payload verilir.
export function listen(socket, event, handler) {
  socket.on(event, (payload) => {
    if (payload && payload._ack) socket.emit('event-ack', payload._eid)
    if (payload && alreadySeen(payload._eid)) return
    if (payload && typeof payload === 'object') {
      // eslint-disable-next-line no-unused-vars
      const { _eid, _ack, ...clean } = payload
      handler(clean)
    } else {
      handler(payload)
    }
  })
}

// Bağlantı kəsilib bərpa olunanda (və server itirilmiş hadisələri geri qaytara bilməyibsə: `socket.recovered === false`)
// vəziyyət serverdən yenidən yüklənir — beləliklə refresh etmədən aktual qalır. İlk qoşulmada işləmir.
export function watchReconnect(socket, resync) {
  let connectedBefore = false
  socket.on('connect', () => {
    if (connectedBefore && !socket.recovered) resync()
    connectedBefore = true
  })
}

export function bindPublicSocket() {
  if (publicBound) return
  publicBound = true

  listen(publicSocket, 'product-updated', ({ product, action }) => {
    useMenuStore.getState().upsertProduct(product, action)
  })
  listen(publicSocket, 'category-updated', ({ category, action }) => {
    useMenuStore.getState().upsertCategory(category, action)
  })
  listen(publicSocket, 'ingredient-updated', ({ ingredient, action }) => {
    useMenuStore.getState().upsertIngredient(ingredient, action)
  })
  listen(publicSocket, 'order-status-updated', (order) => {
    useOrderStore.getState().updateOrder(order)
  })
  listen(publicSocket, 'restaurant-updated', (restaurant) => {
    useRestaurantStore.setState({ restaurant })
  })

  watchReconnect(publicSocket, () => {
    useMenuStore.getState().fetchAll(undefined, { silent: true })
    useRestaurantStore.getState().fetch().catch(() => {})
    useOrderStore.getState().refreshCurrentOrder()
  })
}

export function bindAdminSocket() {
  if (adminBound) return
  adminBound = true

  listen(adminSocket, 'product-updated', ({ product, action }) => {
    useMenuStore.getState().upsertProduct(product, action)
  })
  listen(adminSocket, 'category-updated', ({ category, action }) => {
    useMenuStore.getState().upsertCategory(category, action)
  })
  listen(adminSocket, 'ingredient-updated', ({ ingredient, action }) => {
    useMenuStore.getState().upsertIngredient(ingredient, action)
  })
  // Yeni sifarişin məhsul adları/masa etiketi siyahı sorğusunda gəlir — ona görə yenidən yükləyirik.
  listen(adminSocket, 'order-created', () => {
    useOrderStore.getState().fetchOrders().catch(() => {})
  })
  listen(adminSocket, 'order-status-updated', (order) => {
    useOrderStore.getState().updateOrder(order)
  })
  listen(adminSocket, 'table-updated', ({ table, action }) => {
    useMenuStore.getState().upsertTable?.(table, action)
  })
  // Bildirişin özü backend-də artıq bazaya yazılıb (id/created_at daxil) — olduğu kimi əlavə edirik.
  listen(adminSocket, 'notification-created', (notification) => {
    useNotificationStore.getState().push(notification)
    playAlert()
    browserNotify(notification.title, notification.body || '')
  })
  // Başqa admin çağırışı qəbul/həll edəndə hamıda status dərhal yenilənir
  listen(adminSocket, 'notification-updated', (notification) => {
    useNotificationStore.getState().replace(notification)
  })

  watchReconnect(adminSocket, () => {
    useOrderStore.getState().fetchOrders().catch(() => {})
    useNotificationStore.getState().fetchAll().catch(() => {})
  })
}
