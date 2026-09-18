import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useFavoritesStore = create(
  persist(
    (set, get) => ({
      ids: [],

      toggle(productId) {
        const ids = get().ids
        set({ ids: ids.includes(productId) ? ids.filter((i) => i !== productId) : [...ids, productId] })
      },
    }),
    { name: 'qrmenu_favorites' },
  ),
)
