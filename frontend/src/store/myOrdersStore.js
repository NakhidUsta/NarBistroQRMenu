import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Müştərinin bu cihazdan verdiyi sifarişlərin (id + gizli token) yerli siyahısı.
export const useMyOrdersStore = create(
  persist(
    (set, get) => ({
      refs: [], // { id, token, createdAt }

      add(id, token) {
        set({ refs: [{ id, token, createdAt: Date.now() }, ...get().refs.filter((r) => r.id !== id)].slice(0, 20) })
      },
    }),
    { name: 'qrmenu_my_orders' },
  ),
)
