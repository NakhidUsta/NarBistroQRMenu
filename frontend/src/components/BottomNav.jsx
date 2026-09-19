import { NavLink } from 'react-router-dom'
import { NavIcon, useNavItems } from './navItems'

// Yalnız telefonda (md-dən aşağı) və BÜTÜN müştəri səhifələrində (məhsul, sifariş daxil) ekranın altında sabitdir —
// məhsula girən müştəri səbəti həmişə tapa bilsin. Kompüterdə eyni bölmə yuxarı başlıqdadır (SiteHeader).
function BottomNav() {
  const items = useNavItems()

  return (
    <nav
      aria-label="Əsas naviqasiya"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-panel/95 backdrop-blur border-t border-border shadow-[0_-8px_24px_-18px_rgba(32,26,22,0.5)] pb-[env(safe-area-inset-bottom)]"
    >
      <div className="max-w-lg mx-auto grid grid-cols-4 px-2">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `relative flex flex-col items-center gap-0.5 py-2.5 text-[10.5px] font-semibold transition-colors ${isActive ? 'text-burgundy' : 'text-muted'}`
            }
          >
            <span className="relative">
              <NavIcon d={item.icon} />
              {item.badge > 0 && (
                <span className={`absolute -top-1.5 -right-2.5 text-[9.5px] font-bold rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center ${item.badgeTone === 'gold' ? 'bg-gold text-ink' : 'bg-burgundy text-cream'}`}>
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
