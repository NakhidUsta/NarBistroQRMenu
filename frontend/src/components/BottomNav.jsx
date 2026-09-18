import { NavLink, useLocation } from 'react-router-dom'
import { useCartStore } from '../store/cartStore'
import { useT } from '../lib/i18n'

const Icon = ({ d }) => (
  <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
)

const ICONS = {
  menu: 'M4 4h6v16H4zM14 4h6v16h-6z',
  favorites: 'M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2z',
  orders: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6',
  cart: 'M3 3h2l.4 2M7 13h10l3-8H5.4M7 13L5.4 5M7 13l-2.3 4.6A1 1 0 0 0 5.6 19H18M9 21.2h.01M18 21.2h.01',
}

function BottomNav() {
  const t = useT()
  const location = useLocation()
  const count = useCartStore((s) => s.items.reduce((sum, i) => sum + i.quantity, 0))

  if (location.pathname.startsWith('/product/') || location.pathname.startsWith('/order/')) return null

  const items = [
    { to: '/menyu', label: t('nav_menu'), icon: ICONS.menu },
    { to: '/favorites', label: t('nav_favorites'), icon: ICONS.favorites },
    { to: '/orders', label: t('nav_orders'), icon: ICONS.orders },
    { to: '/cart', label: t('cart'), icon: ICONS.cart, badge: count },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-panel/95 backdrop-blur border-t border-border shadow-[0_-8px_24px_-18px_rgba(32,26,22,0.5)]">
      <div className="max-w-lg mx-auto grid grid-cols-4 px-2">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `relative flex flex-col items-center gap-0.5 py-2.5 text-[10.5px] font-semibold transition-colors ${
                isActive ? 'text-burgundy' : 'text-muted'
              }`
            }
          >
            <span className="relative">
              <Icon d={item.icon} />
              {item.badge > 0 && (
                <span className="absolute -top-1.5 -right-2.5 bg-burgundy text-cream text-[9.5px] font-bold rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center">
                  {item.badge}
                </span>
              )}
            </span>
            {item.label}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}

export default BottomNav
