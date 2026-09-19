import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useMenuStore } from '../store/menuStore'
import { useRestaurantStore } from '../store/restaurantStore'
import { hideSplash, sinceNavigationStart, MIN_VISIBLE_MS, MAX_VISIBLE_MS } from '../lib/splash'

const STAFF_PREFIXES = ['/admin', '/kitchen']

// Açılış ekranını nə vaxt götürməli: müştəri səhifələrində restoran məlumatı və menyu yüklənəndə (uğurlu və ya xətalı — oflayn halda
// keşlənmiş menyu ilə açılır); işçi səhifələrində isə tətbiq hazır olan kimi. Həmişə ən azı MIN, ən çoxu MAX müddət göstərilir.
function SplashGate() {
  const { pathname } = useLocation()
  const staff = STAFF_PREFIXES.some((p) => pathname.startsWith(p))
  const menuStatus = useMenuStore((s) => s.status)
  const restaurant = useRestaurantStore((s) => s.restaurant)
  const ready = staff || (menuStatus === 'ready' || menuStatus === 'error') && (!!restaurant || menuStatus === 'error')

  useEffect(() => {
    const failsafe = setTimeout(hideSplash, Math.max(0, MAX_VISIBLE_MS - sinceNavigationStart()))
    return () => clearTimeout(failsafe)
  }, [])

  useEffect(() => {
    if (!ready) return undefined
    const wait = Math.max(0, MIN_VISIBLE_MS - sinceNavigationStart())
    const timer = setTimeout(hideSplash, wait)
    return () => clearTimeout(timer)
  }, [ready])

  return null
}

export default SplashGate
