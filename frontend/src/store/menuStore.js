import { create } from 'zustand'
import { allergensApi, categoriesApi, ingredientsApi, productsApi } from '../lib/api'

export const useMenuStore = create((set, get) => ({
  categories: [],
  products: [],
  allergens: [],
  ingredients: [],
  status: 'idle',

  // silent — arxa plan sinxronu: skeleton göstərilmir, xəta olarsa mövcud (keşlənmiş) menyu saxlanılır
  async fetchAll(params, { silent = false } = {}) {
    if (!silent) set({ status: 'loading' })
    try {
      const [categories, products, allergens, ingredients] = await Promise.all([
        categoriesApi.list(),
        productsApi.list(params),
        // allergen kataloqu menyunu bloklamasın
        allergensApi.list().catch(() => get().allergens),
        ingredientsApi.list().catch(() => get().ingredients),
      ])
      set({ categories, products, allergens, ingredients, status: 'ready' })
    } catch {
      if (!silent) set({ status: 'error' })
    }
  },

  // Sosket hadisəsi bəzən qismən məhsul gətirir (məs. stok yenilənməsi) — mövcud sahələri (images, allergen_ids) itirməmək üçün birləşdirilir
  upsertProduct(product, action) {
    if (action === 'deleted') {
      set({ products: get().products.filter((p) => p.id !== product.id) })
      return
    }
    const products = get().products
    const exists = products.some((p) => p.id === product.id)
    set({
      products: exists
        ? products.map((p) => (p.id === product.id ? { ...p, ...product } : p))
        : [...products, product],
    })
  },

  upsertIngredient(ingredient, action) {
    const list = get().ingredients
    if (action === 'deleted') {
      set({ ingredients: list.filter((i) => i.id !== ingredient.id) })
      return
    }
    const exists = list.some((i) => i.id === ingredient.id)
    set({ ingredients: exists ? list.map((i) => (i.id === ingredient.id ? ingredient : i)) : [...list, ingredient] })
  },

  upsertCategory(category, action) {
    if (action === 'deleted') {
      set({ categories: get().categories.filter((c) => c.id !== category.id) })
      return
    }
    const categories = get().categories
    const exists = categories.some((c) => c.id === category.id)
    set({
      categories: exists
        ? categories.map((c) => (c.id === category.id ? category : c))
        : [...categories, category].sort((a, b) => a.sort_order - b.sort_order),
    })
  },
}))
