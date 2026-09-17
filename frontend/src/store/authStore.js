import { create } from 'zustand'
import { authApi } from '../lib/api'

export const useAuthStore = create((set) => ({
  admin: null,
  status: 'idle', // idle | loading | ready

  async fetchMe() {
    set({ status: 'loading' })
    try {
      const { admin } = await authApi.me()
      set({ admin, status: 'ready' })
    } catch {
      set({ admin: null, status: 'ready' })
    }
  },

  async login(email, password) {
    const { admin } = await authApi.login(email, password)
    set({ admin, status: 'ready' })
    return admin
  },

  async logout() {
    await authApi.logout().catch(() => {})
    set({ admin: null })
  },
}))
