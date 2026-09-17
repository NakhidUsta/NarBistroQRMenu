import { publicSocket, adminSocket } from './socket'
import { useMenuStore } from '../store/menuStore'
import { useOrderStore } from '../store/orderStore'
import { useNotificationStore } from '../store/notificationStore'

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
  publicSocket.on('order-status-updated', (order) => {
    useOrderStore.getState().updateOrder(order)
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
  adminSocket.on('order-created', (order) => {
    useOrderStore.getState().addOrder(order)
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
  })
}
