import { create } from 'zustand'

let toastId = 0

export const useUiStore = create((set, get) => ({
  toasts: [],

  showToast(message, variant = 'success') {
    const id = ++toastId
    set({ toasts: [...get().toasts, { id, message, variant }] })
    setTimeout(() => {
      set({ toasts: get().toasts.filter((t) => t.id !== id) })
    }, 3000)
  },
}))
