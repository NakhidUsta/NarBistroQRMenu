import { create } from 'zustand'
import { notificationsApi } from '../lib/api'

const normalize = (n) => ({ ...n, isRead: n.is_read ?? n.isRead ?? false })
// Verilənlər bazası çökəndə göndərilən müvəqqəti (yazılmamış) bildirişlərin ID-si mənfidir — serverdə qarşılığı yoxdur
const isEphemeral = (id) => id < 0
const PAGE_SIZE = 50
// Canlı gələn bildirişlər siyahını sonsuz böyütməsin (yüklənmiş səhifələr saxlanılır)
const MAX_ITEMS = 500

export const useNotificationStore = create((set, get) => ({
  items: [],
  hasMore: false, // serverdə göstərilməyən köhnə bildirişlər var
  loadingMore: false,

  async fetchAll() {
    const { items, hasMore } = await notificationsApi.listPage({ limit: PAGE_SIZE })
    // fetch zamanı yalnız serverdə olmayan müvəqqəti xəbərdarlıqlar saxlanılır
    const ephemeral = get().items.filter((n) => isEphemeral(n.id))
    set({ items: [...ephemeral, ...items.map(normalize)], hasMore })
  },

  // Kursor səhifələmə: ən köhnə yüklənmiş bildirişin ID-sindən əvvəlkiləri gətirir
  async loadMore() {
    const { items, hasMore, loadingMore } = get()
    const persisted = items.filter((n) => !isEphemeral(n.id))
    if (!hasMore || loadingMore || !persisted.length) return
    set({ loadingMore: true })
    try {
      const oldest = Math.min(...persisted.map((n) => n.id))
      const { items: page, hasMore: more } = await notificationsApi.listPage({ limit: PAGE_SIZE, before: oldest })
      const seen = new Set(get().items.map((n) => n.id))
      set({ items: [...get().items, ...page.filter((n) => !seen.has(n.id)).map(normalize)], hasMore: more })
    } finally {
      set({ loadingMore: false })
    }
  },

  push(notification) {
    const items = get().items
    if (items.some((n) => n.id === notification.id)) return
    set({ items: [normalize(notification), ...items].slice(0, MAX_ITEMS) })
  },

  // Başqa admin çağırışı qəbul/həll edəndə (socket) və ya öz əməliyyatımızdan sonra elementi yeniləyir
  replace(notification) {
    set({ items: get().items.map((n) => (n.id === notification.id ? normalize(notification) : n)) })
  },

  async markRead(id) {
    if (!isEphemeral(id)) await notificationsApi.markRead(id)
    set({ items: get().items.map((n) => (n.id === id ? { ...n, isRead: true } : n)) })
  },

  // Call Waiter / Request Bill: 'ACCEPTED' ([Qəbul et]) və ya 'RESOLVED' ([Həll edildi])
  async setStatus(id, status) {
    const updated = await notificationsApi.setStatus(id, status)
    get().replace(updated)
    return updated
  },

  async remove(id) {
    if (!isEphemeral(id)) await notificationsApi.remove(id)
    set({ items: get().items.filter((n) => n.id !== id) })
  },

  async clearRead() {
    await notificationsApi.clearRead()
    // həll olunmamış çağırışlar serverdə silinmir — burada da saxlanılır
    set({ items: get().items.filter((n) => !n.isRead || (['call_waiter', 'request_bill'].includes(n.type) && n.status !== 'RESOLVED')) })
  },

  async markAllRead() {
    await notificationsApi.markAllRead()
    set({ items: get().items.map((n) => ({ ...n, isRead: true })) })
  },
}))
