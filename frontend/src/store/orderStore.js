import { create } from 'zustand'
import { ordersApi } from '../lib/api'

export const useOrderStore = create((set, get) => ({
  orders: [], // admin lövhəsi üçün
  filters: {}, // aktiv axtarış/filtr — canlı yenilənmədə saxlanılır
  currentOrder: null, // müştəri izləmə səhifəsi üçün
  currentRef: null, // { id, token } — bağlantı bərpasında sifarişi yenidən yükləmək üçün

  // params verilməsə cari filtrlərlə yenidən yükləyir (socket hadisələrində filtr itməsin deyə).
  async fetchOrders(params) {
    const filters = params ?? get().filters
    const orders = await ordersApi.list(filters)
    set({ orders, filters })
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
