import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { useMenuStore } from '../store/menuStore'
import { useRestaurantStore } from '../store/restaurantStore'
import { useTableSessionStore } from '../store/tableSessionStore'
import { publicSocket } from '../lib/socket'
import { bindPublicSocket } from '../lib/socketBindings'
import { useT, useLocalize } from '../lib/i18n'
import Toast from './Toast'
import TableActions from './TableActions'
import LanguageSwitcher from './LanguageSwitcher'
import BottomNav from './BottomNav'

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

  useEffect(() => {
    const name = localize(restaurant, 'name')
    if (name) document.title = `${name} — Menu`
  }, [restaurant, localize])

  return (
    <div className="min-h-screen bg-cream text-ink font-body">
     <div className="max-w-lg mx-auto relative min-h-screen bg-cream sm:shadow-[0_0_60px_-30px_rgba(32,26,22,0.4)]">
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
      <BottomNav />
      <Toast />
     </div>
    </div>
  )
}

export default PublicLayout
