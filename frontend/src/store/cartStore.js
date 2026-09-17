import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useCartStore = create(
  persist(
    (set, get) => ({
      items: [], // { product_id, name, price, image_url, quantity }

      addItem(product, quantity = 1) {
        const items = get().items
        const existing = items.find((i) => i.product_id === product.id)
        if (existing) {
          set({
            items: items.map((i) =>
              i.product_id === product.id ? { ...i, quantity: i.quantity + quantity } : i,
            ),
          })
        } else {
          set({
            items: [
              ...items,
              {
                product_id: product.id,
                name: product.name,
                price: Number(product.price),
                image_url: product.image_url,
                quantity,
              },
            ],
          })
        }
      },

      updateQuantity(productId, quantity) {
        if (quantity <= 0) {
          set({ items: get().items.filter((i) => i.product_id !== productId) })
          return
        }
        set({ items: get().items.map((i) => (i.product_id === productId ? { ...i, quantity } : i)) })
      },

      removeItem(productId) {
        set({ items: get().items.filter((i) => i.product_id !== productId) })
      },

      clear() {
        set({ items: [] })
      },

      get total() {
        return get().items.reduce((sum, i) => sum + i.price * i.quantity, 0)
      },

      get count() {
        return get().items.reduce((sum, i) => sum + i.quantity, 0)
      },
    }),
    { name: 'qrmenu_cart' },
  ),
)
