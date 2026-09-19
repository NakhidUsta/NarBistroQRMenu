import { imageVariants, resolveUploadUrl } from './api'

// Açılış ekranı (intro) — HTML-də (index.html) hazırdır və JS yüklənməmişdən görünür. Bu modul:
//  • restoranın adı/loqosu/rənglərini yadda saxlayır ki, növbəti girişdə intro artıq restoranın öz brendi ilə açılsın;
//  • saytın hazır olduğu anda intro-nu solduraraq silir.
const BRAND_KEY = 'qrmenu_brand'
export const MIN_VISIBLE_MS = 800 // çox tez yanıb-sönməsin
export const MAX_VISIBLE_MS = 8000 // nə olursa olsun intro ekranda ilişib qalmasın

export function saveBrand(restaurant, theme = {}) {
  try {
    const logo = restaurant.logo_url ? resolveUploadUrl(imageVariants(restaurant.logo_url)?.thumb || restaurant.logo_url) : null
    localStorage.setItem(BRAND_KEY, JSON.stringify({ name: restaurant.name, logo, primary: theme.primary || null, background: theme.background || null }))
  } catch {
    // yaddaş bağlıdırsa (məxfi rejim) intro standart görünüşlə qalır
  }
}

export function hideSplash() {
  const el = typeof document !== 'undefined' ? document.getElementById('splash') : null
  if (!el || el.dataset.hiding) return
  el.dataset.hiding = '1'
  el.classList.add('splash-hide')
  setTimeout(() => el.remove(), 500)
}

// Səhifənin açılmasından bəri keçən vaxt (ms)
export const sinceNavigationStart = () => (typeof performance !== 'undefined' ? performance.now() : MIN_VISIBLE_MS)
