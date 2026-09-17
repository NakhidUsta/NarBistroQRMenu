import { create } from 'zustand'
import { categoriesApi, productsApi } from '../lib/api'

export const useMenuStore = create((set, get) => ({
  categories: [],
  products: [],
  status: 'idle',

  async fetchAll(params) {
    set({ status: 'loading' })
    const [categories, products] = await Promise.all([
      categoriesApi.list(),
      productsApi.list(params),
    ])
    set({ categories, products, status: 'ready' })
  },

  upsertProduct(product, action) {
    if (action === 'deleted') {
      set({ products: get().products.filter((p) => p.id !== product.id) })
      return
    }
    const products = get().products
    const exists = products.some((p) => p.id === product.id)
    set({
      products: exists
        ? products.map((p) => (p.id === product.id ? product : p))
        : [...products, product],
    })
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
