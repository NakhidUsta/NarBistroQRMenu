import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { ordersApi } from '../lib/api'
import { useMyOrdersStore } from './myOrdersStore'

// Offline sifariş növbəsi: internet yoxdursa (və ya sorğu şəbəkə xətası ilə kəsilibsə) sifariş cihazda saxlanılır,
// bağlantı qayıdanda avtomatik göndərilir. Hər elementin sabit client_request_id-si var — backend eyni ID-ni təkrar
// qəbul etsə belə ikinci sifariş yaratmır (idempotency), ona görə təkrar cəhd təhlükəsizdir.
//   status: 'pending' (göndərilməyi gözləyir) | 'needs_confirm' (qiymət dəyişib, müştəri təsdiqləməlidir) | 'failed' (server rədd etdi)

export function newRequestId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('')
}

export const useOutboxStore = create(
  persist(
    (set, get) => ({
      items: [],
      flushing: false,

      enqueue(id, payload, summary) {
        if (get().items.some((i) => i.id === id)) return
        set({ items: [...get().items, { id, payload, summary, status: 'pending', createdAt: Date.now() }] })
      },

      update(id, patch) {
        set({ items: get().items.map((i) => (i.id === id ? { ...i, ...patch } : i)) })
      },

      discard(id) {
        set({ items: get().items.filter((i) => i.id !== id) })
      },

      // Gözləyən sifarişləri göndərir; uğurla göndərilənlərin siyahısını qaytarır.
      async flush() {
        if (get().flushing || (typeof navigator !== 'undefined' && navigator.onLine === false)) return []
        set({ flushing: true })
        const sent = []
        try {
          for (const item of get().items.filter((i) => i.status === 'pending')) {
            try {
              const order = await ordersApi.create({ ...item.payload, client_request_id: item.id })
              useMyOrdersStore.getState().add(order.id, order.access_token)
              get().discard(item.id)
              sent.push(order)
            } catch (err) {
              const res = err.response
              if (!res || res.status >= 500) break // hələ də offline / server müvəqqəti işləmir — növbəti dəfə yenə cəhd
              if (res.status === 409 && res.data?.code === 'PRICE_CHANGED') {
                get().update(item.id, { status: 'needs_confirm', quote: { total: res.data.total, previous_total: res.data.previous_total } })
              } else {
                get().update(item.id, { status: 'failed', error: res.data?.error || 'Sifariş qəbul edilmədi' })
              }
            }
          }
        } finally {
          set({ flushing: false })
        }
        return sent
      },

      // Müştəri yeni məbləği təsdiqləyir — sifariş həmin məbləğlə yenidən göndərilir
      async confirmPrice(id) {
        const item = get().items.find((i) => i.id === id)
        if (!item?.quote) return []
        get().update(id, { status: 'pending', payload: { ...item.payload, expected_total: item.quote.total }, quote: undefined })
        return get().flush()
      },
    }),
    { name: 'qrmenu_outbox', partialize: (s) => ({ items: s.items }) },
  ),
)
