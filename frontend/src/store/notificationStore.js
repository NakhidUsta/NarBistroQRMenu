import { create } from 'zustand'
import { notificationsApi } from '../lib/api'

export const useNotificationStore = create((set, get) => ({
  items: [],

  async fetchAll() {
    const items = await notificationsApi.list()
    set({ items: items.map((n) => ({ ...n, isRead: n.is_read })) })
  },

  push(notification) {
    const items = get().items
    if (items.some((n) => n.id === notification.id)) return
    set({ items: [{ ...notification, isRead: notification.is_read ?? false }, ...items].slice(0, 50) })
  },

  async markRead(id) {
    await notificationsApi.markRead(id)
    set({ items: get().items.map((n) => (n.id === id ? { ...n, isRead: true } : n)) })
  },

  async markAllRead() {
    await notificationsApi.markAllRead()
    set({ items: get().items.map((n) => ({ ...n, isRead: true })) })
  },

  get unreadCount() {
    return get().items.filter((n) => !n.isRead).length
  },
}))
