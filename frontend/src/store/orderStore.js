import { create } from 'zustand'
import { ordersApi } from '../lib/api'

const MAX_LIMIT = 200 // backend maksimumu

export const useOrderStore = create((set, get) => ({
  orders: [], // admin lövhəsi üçün
  filters: {}, // aktiv axtarış/filtr (səhifə ölçüsü `limit` də daxil) — canlı yenilənmədə saxlanılır
  hasMore: false, // serverdə göstərilməyən köhnə sifarişlər var
  loadingMore: false,
  currentOrder: null, // müştəri izləmə səhifəsi üçün
  currentRef: null, // { id, token } — bağlantı bərpasında sifarişi yenidən yükləmək üçün

  // params verilməsə (socket yeniləməsi) cari filtrlərlə yenidən yükləyir və artıq yüklənmiş səhifələrin sayını saxlayır —
  // yeni sifariş gələndə istifadəçinin "Daha çox" ilə açdığı siyahı ilk səhifəyə qayıtmasın.
  async fetchOrders(params) {
    const refresh = params === undefined
    const { orders, filters: previous } = get()
    const filters = params ?? previous
    const pageSize = filters.limit ?? MAX_LIMIT
    const limit = refresh ? Math.min(Math.max(orders.length, pageSize), MAX_LIMIT) : pageSize
    const { items, hasMore } = await ordersApi.listPage({ ...filters, limit })
    set({ orders: items, filters, hasMore })
  },

  // Kursor səhifələmə: ən köhnə göstərilən sifarişin ID-sindən əvvəlkiləri gətirir
  async loadMore() {
    const { orders, filters, hasMore, loadingMore } = get()
    if (!hasMore || loadingMore || !orders.length) return
    set({ loadingMore: true })
    try {
      const { items, hasMore: more } = await ordersApi.listPage({ ...filters, limit: filters.limit ?? MAX_LIMIT, before: orders[orders.length - 1].id })
      const seen = new Set(orders.map((o) => o.id))
      set({ orders: [...orders, ...items.filter((o) => !seen.has(o.id))], hasMore: more })
    } finally {
      set({ loadingMore: false })
    }
  },

  async fetchOrder(id, token) {
    const order = await ordersApi.get(id, token)
    set({ currentOrder: order, currentRef: { id, token } })
    return order
  },

  // Socket bağlantısı kəsilib bərpa olunanda açıq sifariş səhifəsinin statusunu serverdən təzələyir
  async refreshCurrentOrder() {
    const ref = get().currentRef
    if (!ref) return null
    try {
      const order = await ordersApi.get(ref.id, ref.token)
      set({ currentOrder: order })
      return order
    } catch {
      return null
    }
  },

  addOrder(order) {
    set({ orders: [order, ...get().orders] })
  },

  updateOrder(order) {
    set({
      orders: get().orders.map((o) => (o.id === order.id ? { ...o, ...order } : o)),
      currentOrder: get().currentOrder?.id === order.id ? { ...get().currentOrder, ...order } : get().currentOrder,
    })
  },

  async changeStatus(id, status, note) {
    const order = await ordersApi.updateStatus(id, status, note)
    get().updateOrder(order)
    return order
  },
}))
