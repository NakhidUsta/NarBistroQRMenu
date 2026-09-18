import { useEffect } from 'react'
import { NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useAdminSocket } from '../lib/useAdminSocket'
import { requestNotificationPermission } from '../lib/alerts'
import Toast from '../components/Toast'
import NotificationBell from './NotificationBell'

const ALL = ['OWNER', 'MANAGER', 'WAITER', 'KITCHEN']
const NAV_ITEMS = [
  { to: '/admin/dashboard', label: 'Dashboard', icon: '📊', roles: ['OWNER', 'MANAGER'] },
  { to: '/admin/orders', label: 'Sifarişlər', icon: '🧾', roles: ALL },
  { to: '/kitchen', label: 'Mətbəx ekranı', icon: '👨‍🍳', roles: ALL },
  { to: '/admin/menu', label: 'Menyu', icon: '🍽️', roles: ['OWNER', 'MANAGER'] },
  { to: '/admin/categories', label: 'Kateqoriyalar', icon: '🏷️', roles: ['OWNER', 'MANAGER'] },
  { to: '/admin/tables', label: 'Masalar / QR', icon: '📱', roles: ['OWNER', 'MANAGER', 'WAITER'] },
  { to: '/admin/promotions', label: 'Promosyonlar', icon: '🎟️', roles: ['OWNER', 'MANAGER'] },
  { to: '/admin/staff', label: 'İşçilər', icon: '👥', roles: ['OWNER'] },
  { to: '/admin/audit', label: 'Audit Log', icon: '📜', roles: ['OWNER', 'MANAGER'] },
  { to: '/admin/settings', label: 'Ayarlar', icon: '⚙️', roles: ['OWNER', 'MANAGER'] },
]

const STATUS_DOT = { connected: 'bg-success', reconnecting: 'bg-gold', disconnected: 'bg-danger' }
const STATUS_TEXT = { connected: 'Canlı', reconnecting: 'Yenidən qoşulur', disconnected: 'Bağlantı yoxdur' }

export function homeFor(role) {
  if (role === 'KITCHEN') return '/kitchen'
  if (role === 'WAITER') return '/admin/orders'
  return '/admin/dashboard'
}

function AdminLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const admin = useAuthStore((s) => s.admin)
  const logout = useAuthStore((s) => s.logout)
  const socketStatus = useAdminSocket()

  useEffect(() => {
    requestNotificationPermission()
  }, [])

  const items = NAV_ITEMS.filter((i) => i.roles.includes(admin?.role))
  const allowed = items.some((i) => location.pathname.startsWith(i.to))
  if (admin && !allowed) return <Navigate to={homeFor(admin.role)} replace />

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
        <nav className="flex-1 px-3 flex flex-col gap-0.5 overflow-y-auto">
          {items.map((item) => (
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
        <header className="h-16 flex items-center justify-end gap-5 px-6 border-b border-border bg-panel">
          <span className="flex items-center gap-2 text-[12px] text-muted font-semibold">
            <span className={`w-2.5 h-2.5 rounded-full ${STATUS_DOT[socketStatus]}`} />
            {STATUS_TEXT[socketStatus]}
          </span>
          {['OWNER', 'MANAGER', 'WAITER'].includes(admin?.role) && <NotificationBell />}
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
