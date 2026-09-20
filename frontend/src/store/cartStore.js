import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Server bir məhsuldan ən çox 99 ədəd qəbul edir (backend orderValidator.MAX_QUANTITY) — səbət də eyni həddə saxlanılır
export const MAX_QUANTITY = 99
const clampQty = (q) => Math.min(Math.max(Math.floor(Number(q)) || 0, 0), MAX_QUANTITY)

export const useCartStore = create(
  persist(
    (set, get) => ({
      items: [], // { product_id, name, price, image_url, quantity }

      addItem(product, rawQuantity = 1) {
        const quantity = clampQty(rawQuantity)
        if (quantity <= 0) return
        const items = get().items
        const existing = items.find((i) => i.product_id === product.id)
        if (existing) {
          set({
            items: items.map((i) =>
              i.product_id === product.id ? { ...i, quantity: clampQty(i.quantity + quantity) } : i,
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

      updateQuantity(productId, rawQuantity) {
        if (Number(rawQuantity) <= 0) {
          set({ items: get().items.filter((i) => i.product_id !== productId) })
          return
        }
        const quantity = clampQty(rawQuantity)
        set({ items: get().items.map((i) => (i.product_id === productId ? { ...i, quantity } : i)) })
      },

      removeItem(productId) {
        set({ items: get().items.filter((i) => i.product_id !== productId) })
      },

      clear() {
        set({ items: [] })
      },

      // Menyudakı canlı qiymətlə səbətdəki qiyməti uyğunlaşdırır; dəyişiklik olubsa true qaytarır.
      syncPrices(products) {
        let changed = false
        const items = get().items.map((i) => {
          const p = products.find((x) => x.id === i.product_id)
          if (p && Number(p.price) !== i.price) {
            changed = true
            return { ...i, price: Number(p.price) }
          }
          return i
        })
        if (changed) set({ items })
        return changed
      },

      removeMany(productIds) {
        set({ items: get().items.filter((i) => !productIds.includes(i.product_id)) })
      },

    }),
    { name: 'qrmenu_cart', partialize: (state) => ({ items: state.items }) },
  ),
)
