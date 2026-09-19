import { useCartStore } from '../store/cartStore'
import { useOutboxStore } from '../store/outboxStore'
import { useT } from '../lib/i18n'

export const NavIcon = ({ d, size = 21 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
)

const ICONS = {
  menu: 'M4 4h6v16H4zM14 4h6v16h-6z',
  favorites: 'M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2z',
  orders: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6',
  cart: 'M3 3h2l.4 2M7 13h10l3-8H5.4M7 13L5.4 5M7 13l-2.3 4.6A1 1 0 0 0 5.6 19H18M9 21.2h.01M18 21.2h.01',
}

// Telefonda alt naviqasiya, kompüterdə başlıq naviqasiyası — eyni siyahı (Menyu / Sevimlilər / Sifarişlər / Səbət)
export function useNavItems() {
  const t = useT()
  const cartCount = useCartStore((s) => s.items.reduce((sum, i) => sum + i.quantity, 0))
  // internet olmadığı üçün göndərilməmiş sifarişlər "Sifarişlər"-də nişanla göstərilir
  const queued = useOutboxStore((s) => s.items.length)
  return [
    { to: '/menyu', label: t('nav_menu'), icon: ICONS.menu },
    { to: '/favorites', label: t('nav_favorites'), icon: ICONS.favorites },
    { to: '/orders', label: t('nav_orders'), icon: ICONS.orders, badge: queued, badgeTone: 'gold' },
    { to: '/cart', label: t('cart'), icon: ICONS.cart, badge: cartCount },
  ]
}
