import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useLocaleStore = create(
  persist(
    (set) => ({
      locale: 'az', // 'az' | 'en' | 'ru'
      setLocale: (locale) => set({ locale }),
    }),
    { name: 'qrmenu_locale' },
  ),
)
