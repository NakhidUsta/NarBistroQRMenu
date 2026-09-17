import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { tablesApi } from '../lib/api'

export const useTableSessionStore = create(
  persist(
    (set) => ({
      table: null, // { code, label } — QR skan edildikdən sonra doldurulur

      async scan(code, token) {
        const table = await tablesApi.scan(code, token)
        set({ table: { code: table.code, label: table.label } })
        return table
      },

      clear() {
        set({ table: null })
      },
    }),
    { name: 'qrmenu_table_session' },
  ),
)
