import { Link, NavLink } from 'react-router-dom'
import { useRestaurantStore } from '../store/restaurantStore'
import { useTableSessionStore } from '../store/tableSessionStore'
import { useT, useLocalize } from '../lib/i18n'
import BrandLogo from './BrandLogo'
import LanguageSwitcher from './LanguageSwitcher'
import { NavIcon, useNavItems } from './navItems'
import { tableText } from '../lib/tableLabel'

// Kompüter (md+) başlığı: loqo + restoran adı solda, naviqasiya (Menyu / Sevimlilər / Sifarişlər / Səbət) və dil sağda.
// Telefonda gizlidir — orada alt naviqasiya (BottomNav) var.
function SiteHeader() {
  const restaurant = useRestaurantStore((s) => s.restaurant)
  const table = useTableSessionStore((s) => s.table)
  const items = useNavItems()
  const t = useT()
  const localize = useLocalize()
  const name = localize(restaurant, 'name') || 'QR Menu'

  return (
    <header className="hidden md:block sticky top-0 z-40 bg-panel/95 backdrop-blur border-b border-border">
      <div className="max-w-6xl mx-auto px-8 h-[68px] flex items-center gap-8">
        <Link to="/menyu" className="flex items-center gap-3 min-w-0 mr-auto">
          <BrandLogo url={restaurant?.logo_url} name={name} className="w-10 h-10" />
          <span className="min-w-0">
            <span className="block font-display text-[21px] font-semibold text-ink leading-tight truncate">{name}</span>
            {table && <span className="block text-[11px] uppercase tracking-[0.16em] text-muted font-semibold">{tableText(t, table)}</span>}
          </span>
        </Link>

        <nav aria-label="Əsas naviqasiya" className="flex items-center gap-1">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `relative flex items-center gap-2 px-4 py-2 rounded-full text-[14px] font-semibold transition-colors ${
                  isActive ? 'bg-burgundy/10 text-burgundy' : 'text-muted hover:text-ink hover:bg-blush/60'
                }`
              }
            >
              <NavIcon d={item.icon} size={18} />
              {item.label}
              {item.badge > 0 && (
                <span className={`text-[10.5px] font-bold rounded-full min-w-[18px] h-[18px] px-1.5 flex items-center justify-center ${item.badgeTone === 'gold' ? 'bg-gold text-ink' : 'bg-burgundy text-cream'}`}>
                  {item.badge}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <LanguageSwitcher />
      </div>
    </header>
  )
}

export default SiteHeader
