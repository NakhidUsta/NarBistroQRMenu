import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { tablesApi } from '../lib/api'

const KEY = 'qrmenu_table_session'
// Köhnə versiyalar masanı localStorage-də saxlayırdı (brauzer bağlansa da qalırdı) — indi istifadə olunmur
try {
  localStorage.removeItem(KEY)
} catch {
  // yaddaş bağlıdırsa keç
}

// Masa yalnız QR ilə açılmış SƏHİFƏ SESSİYASINA aiddir (sessionStorage): QR oxudulan tabda səbət/sifariş axını boyunca
// (yeniləmə, səhifələr arası keçid) qalır; adi linklə yeni açılışda isə masa yoxdur.
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
    { name: KEY, storage: createJSONStorage(() => sessionStorage) },
  ),
)
