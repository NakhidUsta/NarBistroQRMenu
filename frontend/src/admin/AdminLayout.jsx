import { useEffect } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { adminSocket } from '../lib/socket'
import { bindAdminSocket } from '../lib/socketBindings'
import Toast from '../components/Toast'
import NotificationBell from './NotificationBell'

const NAV_ITEMS = [
  { to: '/admin/dashboard', label: 'Dashboard', icon: '📊' },
  { to: '/admin/orders', label: 'Sifarişlər', icon: '🧾' },
  { to: '/admin/menu', label: 'Menyu', icon: '🍽️' },
  { to: '/admin/categories', label: 'Kateqoriyalar', icon: '🏷️' },
  { to: '/admin/tables', label: 'Masalar / QR', icon: '📱' },
  { to: '/admin/promotions', label: 'Promosyonlar', icon: '🎟️' },
  { to: '/admin/settings', label: 'Ayarlar', icon: '⚙️' },
]

function AdminLayout() {
  const navigate = useNavigate()
  const admin = useAuthStore((s) => s.admin)
  const logout = useAuthStore((s) => s.logout)

  useEffect(() => {
    bindAdminSocket()
    if (!adminSocket.connected) adminSocket.connect()
    return () => {
      adminSocket.disconnect()
    }
  }, [])

  async function handleLogout() {
    await logout()
    navigate('/admin/login')
  }

  return (
    <div className="min-h-screen flex bg-cream text-ink">
      <aside className="w-60 bg-ink text-cream flex flex-col shrink-0">
        <div className="px-5 py-6">
          <p className="font-display text-lg font-semibold">QR Menu</p>
          <p className="text-[11px] text-cream/50 uppercase tracking-wider">Admin panel</p>
        </div>
        <nav className="flex-1 px-3 flex flex-col gap-0.5">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13.5px] font-medium transition-colors ${
                  isActive ? 'bg-burgundy text-cream' : 'text-cream/70 hover:bg-white/5 hover:text-cream'
                }`
              }
            >
              <span>{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="px-5 py-5 border-t border-white/10">
          <p className="text-[12.5px] font-semibold truncate">{admin?.email}</p>
          <p className="text-[11px] text-cream/50 uppercase tracking-wider mb-3">{admin?.role}</p>
          <button onClick={handleLogout} className="text-[12.5px] font-semibold text-cream/70 hover:text-cream">
            Çıxış et
          </button>
        </div>
      </aside>

      <div className="flex-1 min-w-0">
        <header className="h-16 flex items-center justify-end px-6 border-b border-border bg-panel">
          <NotificationBell />
        </header>
        <main className="p-6">
          <Outlet />
        </main>
      </div>
      <Toast />
    </div>
  )
}

export default AdminLayout
