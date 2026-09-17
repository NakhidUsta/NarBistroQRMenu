import { useEffect } from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import { useMenuStore } from '../store/menuStore'
import { useCartStore } from '../store/cartStore'
import { useRestaurantStore } from '../store/restaurantStore'
import { useTableSessionStore } from '../store/tableSessionStore'
import { publicSocket } from '../lib/socket'
import { bindPublicSocket } from '../lib/socketBindings'
import { useT, useLocalize } from '../lib/i18n'
import Toast from './Toast'
import TableActions from './TableActions'
import LanguageSwitcher from './LanguageSwitcher'

function CartFab() {
  const count = useCartStore((s) => s.items.reduce((sum, i) => sum + i.quantity, 0))
  const location = useLocation()
  const t = useT()
  if (!count || location.pathname === '/cart') return null

  return (
    <Link
      to="/cart"
      className="fixed bottom-5 right-5 z-40 flex items-center gap-2 bg-burgundy text-cream rounded-full pl-4 pr-5 py-3.5 shadow-[0_14px_30px_-10px_rgba(92,26,46,0.55)] hover:-translate-y-0.5 transition-transform"
    >
      <span className="relative">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 3h2l.4 2M7 13h10l3-8H6.4M7 13L5.4 5M7 13l-2.3 4.6A1 1 0 0 0 5.6 19H18" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="9" cy="21" r="1" fill="currentColor" />
          <circle cx="18" cy="21" r="1" fill="currentColor" />
        </svg>
      </span>
      <span className="font-semibold text-[14px]">{t('cart')} ({count})</span>
    </Link>
  )
}

function PublicLayout() {
  const location = useLocation()
  const fetchMenu = useMenuStore((s) => s.fetchAll)
  const fetchRestaurant = useRestaurantStore((s) => s.fetch)
  const restaurant = useRestaurantStore((s) => s.restaurant)
  const table = useTableSessionStore((s) => s.table)
  const t = useT()
  const localize = useLocalize()

  useEffect(() => {
    fetchRestaurant()
    fetchMenu()
    bindPublicSocket()
    if (!publicSocket.connected) {
      if (table?.code) {
        publicSocket.io.opts.query = { table: table.code }
      }
      publicSocket.connect()
    }
  }, [])

  const isSubPage = location.pathname !== '/menyu' && location.pathname !== '/'

  return (
    <div className="min-h-screen bg-cream text-ink font-body">
      {!isSubPage && (
        <header className="px-5 pt-6 pb-2 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted font-semibold truncate">
              {table ? `${t('table_label')} — ${table.label}` : t('welcome')}
            </p>
            <h1 className="font-display text-[26px] font-semibold text-ink truncate">
              {localize(restaurant, 'name') || 'QR Menu'}
            </h1>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <LanguageSwitcher />
            {restaurant?.logo_url && (
              <img src={restaurant.logo_url} alt="" className="w-11 h-11 rounded-full object-cover border-2 border-border" />
            )}
          </div>
        </header>
      )}
      {!isSubPage && <TableActions />}
      <Outlet />
      <CartFab />
      <Toast />
    </div>
  )
}

export default PublicLayout
