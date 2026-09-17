import { create } from 'zustand'
import { restaurantApi } from '../lib/api'

export const useRestaurantStore = create((set) => ({
  restaurant: null,

  async fetch() {
    const restaurant = await restaurantApi.get()
    set({ restaurant })
  },

  async update(body) {
    const restaurant = await restaurantApi.update(body)
    set({ restaurant })
    return restaurant
  },
}))
