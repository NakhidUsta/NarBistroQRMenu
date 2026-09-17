import { create } from 'zustand'
import { ordersApi } from '../lib/api'

export const useOrderStore = create((set, get) => ({
  orders: [], // admin lövhəsi üçün
  currentOrder: null, // müştəri izləmə səhifəsi üçün

  async fetchOrders(params) {
    const orders = await ordersApi.list(params)
    set({ orders })
  },

  async fetchOrder(id, token) {
    const order = await ordersApi.get(id, token)
    set({ currentOrder: order })
    return order
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
