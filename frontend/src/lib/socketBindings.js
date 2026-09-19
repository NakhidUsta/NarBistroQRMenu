import { publicSocket, adminSocket } from './socket'
import { useMenuStore } from '../store/menuStore'
import { useOrderStore } from '../store/orderStore'
import { useNotificationStore } from '../store/notificationStore'
import { useRestaurantStore } from '../store/restaurantStore'
import { playAlert, browserNotify } from './alerts'

let publicBound = false
let adminBound = false

export function bindPublicSocket() {
  if (publicBound) return
  publicBound = true

  publicSocket.on('product-updated', ({ product, action }) => {
    useMenuStore.getState().upsertProduct(product, action)
  })
  publicSocket.on('category-updated', ({ category, action }) => {
    useMenuStore.getState().upsertCategory(category, action)
  })
  publicSocket.on('ingredient-updated', ({ ingredient, action }) => {
    useMenuStore.getState().upsertIngredient(ingredient, action)
  })
  publicSocket.on('order-status-updated', (order) => {
    useOrderStore.getState().updateOrder(order)
  })
  publicSocket.on('restaurant-updated', (restaurant) => {
    useRestaurantStore.setState({ restaurant })
  })
}

export function bindAdminSocket() {
  if (adminBound) return
  adminBound = true

  adminSocket.on('product-updated', ({ product, action }) => {
    useMenuStore.getState().upsertProduct(product, action)
  })
  adminSocket.on('category-updated', ({ category, action }) => {
    useMenuStore.getState().upsertCategory(category, action)
  })
  adminSocket.on('ingredient-updated', ({ ingredient, action }) => {
    useMenuStore.getState().upsertIngredient(ingredient, action)
  })
  // Yeni sifarişin məhsul adları/masa etiketi siyahı sorğusunda gəlir — ona görə yenidən yükləyirik.
  adminSocket.on('order-created', () => {
    useOrderStore.getState().fetchOrders().catch(() => {})
  })
  adminSocket.on('order-status-updated', (order) => {
    useOrderStore.getState().updateOrder(order)
  })
  adminSocket.on('table-updated', ({ table, action }) => {
    useMenuStore.getState().upsertTable?.(table, action)
  })
  // Bildirişin özü backend-də artıq bazaya yazılıb (id/created_at daxil) — olduğu kimi əlavə edirik.
  adminSocket.on('notification-created', (notification) => {
    useNotificationStore.getState().push(notification)
    playAlert()
    browserNotify(notification.title, notification.body || '')
  })
  // Başqa admin çağırışı qəbul/həll edəndə hamıda status dərhal yenilənir
  adminSocket.on('notification-updated', (notification) => {
    useNotificationStore.getState().replace(notification)
  })
}
