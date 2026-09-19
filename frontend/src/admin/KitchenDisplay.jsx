import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useOrderStore } from '../store/orderStore'
import { useAuthStore } from '../store/authStore'
import { useUiStore } from '../store/uiStore'
import { useAdminSocket } from '../lib/useAdminSocket'
import Toast from '../components/Toast'

const COLUMNS = [
  { key: 'new', title: 'Yeni', statuses: ['NEW', 'CONFIRMED'], next: 'PREPARING', action: 'Hazırlanmağa başla', tone: 'border-gold' },
  { key: 'preparing', title: 'Hazırlanır', statuses: ['PREPARING'], next: 'READY', action: 'Hazırdır', tone: 'border-burgundy-light' },
  { key: 'ready', title: 'Hazırdır', statuses: ['READY'], next: 'DELIVERED', action: 'Təhvil verildi', tone: 'border-success' },
]

const STATUS_DOT = { connected: 'bg-success', reconnecting: 'bg-gold', disconnected: 'bg-danger' }
const STATUS_TEXT = { connected: 'Bağlıdır', reconnecting: 'Yenidən qoşulur...', disconnected: 'Bağlantı kəsilib' }

function minutesAgo(date, now) {
  return Math.max(0, Math.floor((now - new Date(date).getTime()) / 60000))
}

function KitchenDisplay() {
  const navigate = useNavigate()
  const orders = useOrderStore((s) => s.orders)
  const fetchOrders = useOrderStore((s) => s.fetchOrders)
  const changeStatus = useOrderStore((s) => s.changeStatus)
  const admin = useAuthStore((s) => s.admin)
  const logout = useAuthStore((s) => s.logout)
  const showToast = useUiStore((s) => s.showToast)
  const socketStatus = useAdminSocket()
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    fetchOrders({})
    const tick = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(tick)
  }, [])

  // Bağlantı bərpa olunanda buraxılmış hadisələri tutmaq üçün siyahını yenidən çək.
  useEffect(() => {
    if (socketStatus === 'connected') fetchOrders()
  }, [socketStatus])

  async function advance(order, next) {
    try {
      await changeStatus(order.id, next)
    } catch (err) {
      showToast(err.response?.data?.error || 'Status yenilənmədi', 'error')
    }
  }

  async function handleLogout() {
    await logout()
    navigate('/admin/login')
  }

  return (
    <div className="min-h-screen bg-ink text-cream p-5">
      <header className="flex items-center justify-between mb-5">
        <div>
          <h1 className="font-display text-[26px] font-semibold">Mətbəx</h1>
          <p className="text-[12px] text-cream/50">{admin?.email}</p>
        </div>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-2 text-[12px] text-cream/70">
            <span className={`w-2.5 h-2.5 rounded-full ${STATUS_DOT[socketStatus]}`} />
            {STATUS_TEXT[socketStatus]}
          </span>
          <button onClick={() => navigate(admin?.role === 'KITCHEN' ? '/admin/account' : '/admin/orders')} className="text-[12.5px] font-semibold text-cream/70 hover:text-cream">
            {admin?.role === 'KITCHEN' ? 'Hesabım' : 'Admin panel'}
          </button>
          <button onClick={handleLogout} className="text-[12.5px] font-semibold text-cream/70 hover:text-cream">Çıxış</button>
        </div>
      </header>

      <div className="grid lg:grid-cols-3 gap-4 items-start">
        {COLUMNS.map((col) => {
          const list = orders
            .filter((o) => col.statuses.includes(o.status))
            .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
          return (
            <section key={col.key} className="bg-white/5 rounded-2xl p-3">
              <h2 className="flex items-center justify-between px-2 py-2 font-semibold text-[15px]">
                {col.title}
                <span className="bg-white/10 rounded-full px-2.5 py-0.5 text-[12px]">{list.length}</span>
              </h2>
              <div className="flex flex-col gap-3">
                {list.length === 0 && <p className="text-cream/40 text-[13px] px-2 py-6 text-center">Sifariş yoxdur</p>}
                {list.map((o) => {
                  const mins = minutesAgo(o.created_at, now)
                  return (
                    <article key={o.id} className={`bg-panel text-ink rounded-xl p-4 border-l-4 ${col.tone}`}>
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-display text-[20px] font-bold leading-none">#{o.id}</p>
                          <p className="text-[13px] font-semibold text-burgundy mt-1">
                            {o.table_label || 'Masasız'}
                          </p>
                        </div>
                        <span className={`text-[12px] font-bold rounded-full px-2.5 py-1 ${mins >= 15 ? 'bg-danger/15 text-danger' : 'bg-blush text-muted'}`}>
                          {mins} dəq
                        </span>
                      </div>
                      <ul className="border-t border-border pt-2 mb-2">
                        {o.items?.map((i, idx) => (
                          <li key={idx} className="flex gap-2 text-[15px] py-0.5">
                            <span className="font-bold w-7 shrink-0">{i.quantity}×</span>
                            <span>{i.name}</span>
                          </li>
                        ))}
                      </ul>
                      {o.note && <p className="text-[12.5px] bg-gold/20 rounded-lg px-2.5 py-1.5 mb-2">📝 {o.note}</p>}
                      <button
                        onClick={() => advance(o, col.next)}
                        className="w-full bg-ink text-cream rounded-lg py-2.5 text-[13.5px] font-semibold hover:bg-burgundy-dark"
                      >
                        {col.action}
                      </button>
                    </article>
                  )
                })}
              </div>
            </section>
          )
        })}
      </div>
      <Toast />
    </div>
  )
}

export default KitchenDisplay
