import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Müştərinin qaçınmaq istədiyi allergenlər (cihazda saxlanılır) — bunları ehtiva edən yeməklər menyudan gizlədilir
export const useAllergenFilterStore = create(
  persist(
    (set, get) => ({
      avoid: [],

      toggle(allergenId) {
        const avoid = get().avoid
        set({ avoid: avoid.includes(allergenId) ? avoid.filter((i) => i !== allergenId) : [...avoid, allergenId] })
      },

      clear() {
        set({ avoid: [] })
      },
    }),
    { name: 'qrmenu_allergen_filter' },
  ),
)

export function hidesProduct(product, avoid) {
  return avoid.length > 0 && (product.allergen_ids || []).some((id) => avoid.includes(id))
}
