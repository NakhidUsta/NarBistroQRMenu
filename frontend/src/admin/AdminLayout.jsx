import { useEffect, useState } from 'react'
import { NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useAdminSocket } from '../lib/useAdminSocket'
import { installAudioUnlock, requestNotificationPermission } from '../lib/alerts'
import { useSoundSettings } from '../lib/soundSettings'
import { useNotificationStore } from '../store/notificationStore'
import Toast from '../components/Toast'
import NotificationBell from './NotificationBell'

const ALL = ['OWNER', 'MANAGER', 'WAITER', 'KITCHEN']
const NAV_ITEMS = [
  { to: '/admin/dashboard', label: 'Dashboard', icon: '📊', roles: ['OWNER', 'MANAGER'] },
  { to: '/admin/orders', label: 'Sifarişlər', icon: '🧾', roles: ALL },
  { to: '/admin/notifications', label: 'Bildirişlər', icon: '🔔', roles: ['OWNER', 'MANAGER', 'WAITER'], badge: true },
  { to: '/kitchen', label: 'Mətbəx ekranı', icon: '👨‍🍳', roles: ALL },
  { to: '/admin/menu', label: 'Menyu', icon: '🍽️', roles: ['OWNER', 'MANAGER'] },
  { to: '/admin/ingredients', label: 'Tərkiblər', icon: '🧂', roles: ['OWNER', 'MANAGER'] },
  { to: '/admin/categories', label: 'Kateqoriyalar', icon: '🏷️', roles: ['OWNER', 'MANAGER'] },
  { to: '/admin/media', label: 'Media', icon: '🖼️', roles: ['OWNER', 'MANAGER'] },
  { to: '/admin/tables', label: 'Masalar / QR', icon: '📱', roles: ['OWNER', 'MANAGER', 'WAITER'] },
  { to: '/admin/promotions', label: 'Promosyonlar', icon: '🎟️', roles: ['OWNER', 'MANAGER'] },
  { to: '/admin/inventory', label: 'Stok', icon: '📦', roles: ['OWNER', 'MANAGER'] },
  { to: '/admin/customers', label: 'Müştərilər', icon: '🧑‍🤝‍🧑', roles: ['OWNER', 'MANAGER'] },
  { to: '/admin/reviews', label: 'Rəylər', icon: '⭐', roles: ['OWNER', 'MANAGER'] },
  { to: '/admin/reports', label: 'Hesabatlar', icon: '📈', roles: ['OWNER', 'MANAGER'] },
  { to: '/admin/staff', label: 'İşçilər', icon: '👥', roles: ['OWNER'] },
  { to: '/admin/audit', label: 'Audit Log', icon: '📜', roles: ['OWNER', 'MANAGER'] },
  { to: '/admin/settings', label: 'Ayarlar', icon: '⚙️', roles: ['OWNER', 'MANAGER'] },
  { to: '/admin/account', label: 'Hesabım', icon: '🔐', roles: ALL },
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
  const [menuOpen, setMenuOpen] = useState(false)
  const unread = useNotificationStore((s) => s.items.filter((n) => !n.isRead).length)
  const soundOn = useSoundSettings((s) => s.enabled)
  const setSoundOn = useSoundSettings((s) => s.setEnabled)

  useEffect(() => {
    requestNotificationPermission()
    // Brauzer səsi yalnız istifadəçi jestindən sonra açır — ilk klikdə avtomatik aktivləşir
    installAudioUnlock()
  }, [])

  // Mobil çəkməcə: səhifə dəyişəndə bağlanır, açıq olanda Escape ilə də bağlanır
  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])
  useEffect(() => {
    if (!menuOpen) return undefined
    const onKey = (e) => e.key === 'Escape' && setMenuOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menuOpen])

  const items = NAV_ITEMS.filter((i) => i.roles.includes(admin?.role))
  const allowed = items.some((i) => location.pathname.startsWith(i.to))
  if (admin && !allowed) return <Navigate to={homeFor(admin.role)} replace />

  async function handleLogout() {
    await logout()
    navigate('/admin/login')
  }

  return (
    <div className="min-h-screen flex bg-cream text-ink">
      {menuOpen && <div className="fixed inset-0 z-30 bg-ink/50 md:hidden" onClick={() => setMenuOpen(false)} aria-hidden="true" />}
      <aside
        id="admin-sidebar"
        className={`fixed inset-y-0 left-0 z-40 w-64 md:w-60 bg-ink text-cream flex flex-col shrink-0 transition-transform duration-200 md:sticky md:top-0 md:h-screen md:translate-x-0 ${menuOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
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
              {item.badge && unread > 0 && (
                <span className="ml-auto bg-danger text-cream text-[10.5px] font-bold rounded-full min-w-5 h-5 px-1.5 flex items-center justify-center" aria-label={`${unread} oxunmamış`}>
                  {unread > 99 ? '99+' : unread}
                </span>
              )}
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
        {admin?.default_password && (
          <div role="alert" data-testid="default-password-warning" className="bg-danger text-white px-4 py-2.5 text-[13px] font-semibold flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center">
            <span>⚠ Hesabınız hələ də məlum defolt şifrədədir — kim isə bu şifrəni bilir. Dərhal dəyişin!</span>
            <NavLink to="/admin/account" className="underline">Şifrəni dəyiş →</NavLink>
          </div>
        )}
        <header className="h-16 flex items-center justify-between md:justify-end gap-3 md:gap-5 px-4 md:px-6 border-b border-border bg-panel sticky top-0 z-20">
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="Menyu"
            aria-expanded={menuOpen}
            aria-controls="admin-sidebar"
            className="md:hidden w-10 h-10 -ml-2 rounded-lg flex items-center justify-center text-ink hover:bg-blush"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
          </button>
          <div className="flex items-center gap-3 md:gap-5">
          <span className="flex items-center gap-2 text-[12px] text-muted font-semibold">
            <span className={`w-2.5 h-2.5 rounded-full ${STATUS_DOT[socketStatus]}`} />
            {STATUS_TEXT[socketStatus]}
          </span>
          {['OWNER', 'MANAGER', 'WAITER'].includes(admin?.role) && (
            <>
              <button
                type="button"
                onClick={() => setSoundOn(!soundOn)}
                aria-label={soundOn ? 'Bildiriş səsini söndür' : 'Bildiriş səsini aç'}
                aria-pressed={soundOn}
                title={soundOn ? 'Səs açıqdır' : 'Səs söndürülüb'}
                className="text-lg leading-none"
              >
                {soundOn ? '🔊' : '🔇'}
              </button>
              <NotificationBell />
            </>
          )}
          </div>
        </header>
        <main className="p-3 sm:p-6">
          <Outlet />
        </main>
      </div>
      <Toast />
    </div>
  )
}

export default AdminLayout
