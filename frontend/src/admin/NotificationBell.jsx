import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useNotificationStore } from '../store/notificationStore'
import { useUiStore } from '../store/uiStore'

const TYPE_ICON = {
  order_created: '🧾',
  call_waiter: '🔔',
  request_bill: '💳',
  low_stock: '📦',
  out_of_stock: '🚫',
  system_error: '⚠️',
}

const HANDLEABLE = ['call_waiter', 'request_bill']
const STOCK_TYPES = ['low_stock', 'out_of_stock']
const FILTERS = [
  ['all', 'Hamısı'],
  ['unread', 'Oxunmamış'],
  ['order_created', 'Sifariş'],
  ['call_waiter', 'Ofisiant'],
  ['request_bill', 'Hesab'],
  ['stock', 'Stok'],
  ['system_error', 'Sistem'],
]

// Bildirişin aid olduğu səhifə (klikləyəndə)
const TARGET = { order: '/admin/orders', table: '/admin/tables', product: '/admin/menu' }

function timeAgo(dateStr) {
  const diffMs = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'indicə'
  if (mins < 60) return `${mins} dəq əvvəl`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} saat əvvəl`
  return new Date(dateStr).toLocaleDateString('az-AZ')
}

function matches(n, filter) {
  if (filter === 'all') return true
  if (filter === 'unread') return !n.isRead
  if (filter === 'stock') return STOCK_TYPES.includes(n.type)
  return n.type === filter
}

// Çağırış / hesab sorğusunun iş statusu və [Qəbul et] / [Həll edildi] düymələri
function HandlePanel({ n }) {
  const setStatus = useNotificationStore((s) => s.setStatus)
  const showToast = useUiStore((s) => s.showToast)
  const [busy, setBusy] = useState(false)

  async function change(status) {
    setBusy(true)
    try {
      await setStatus(n.id, status)
    } catch (err) {
      showToast(err.response?.data?.error || 'Status dəyişmədi', 'error')
    } finally {
      setBusy(false)
    }
  }

  const who = n.handled_by_email ? ` · ${n.handled_by_email.split('@')[0]}` : ''
  const btn = 'px-2.5 py-1 rounded-full text-[11px] font-bold disabled:opacity-50'

  return (
    <div className="flex flex-wrap items-center gap-1.5 px-4 pb-3 pl-[42px]" data-testid="handle-panel">
      {n.status === 'OPEN' && <span className="text-[10.5px] font-bold uppercase tracking-wide text-gold">Gözləyir</span>}
      {n.status === 'ACCEPTED' && <span className="text-[10.5px] font-bold uppercase tracking-wide text-burgundy">Qəbul edildi{who}</span>}
      {n.status === 'RESOLVED' && <span className="text-[10.5px] font-bold uppercase tracking-wide text-success">✓ Həll edildi{who}</span>}
      {n.status === 'OPEN' && (
        <button type="button" disabled={busy} onClick={() => change('ACCEPTED')} className={`${btn} bg-burgundy text-white`}>Qəbul et</button>
      )}
      {n.status !== 'RESOLVED' && (
        <button type="button" disabled={busy} onClick={() => change('RESOLVED')} className={`${btn} border border-border text-ink`}>Həll edildi</button>
      )}
    </div>
  )
}

function NotificationBell() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const items = useNotificationStore((s) => s.items)
  const fetchAll = useNotificationStore((s) => s.fetchAll)
  const markRead = useNotificationStore((s) => s.markRead)
  const markAllRead = useNotificationStore((s) => s.markAllRead)
  const remove = useNotificationStore((s) => s.remove)
  const clearRead = useNotificationStore((s) => s.clearRead)
  const [filter, setFilter] = useState('all')
  const unread = items.filter((n) => !n.isRead).length
  const pendingCalls = items.filter((n) => HANDLEABLE.includes(n.type) && n.status !== 'RESOLVED').length
  const visible = items.filter((n) => matches(n, filter))

  useEffect(() => {
    fetchAll()
  }, [])

  useEffect(() => {
    function onClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  function handleItemClick(n) {
    if (!n.isRead) markRead(n.id)
    const target = TARGET[n.entity_type]
    if (target && n.entity_id) {
      navigate(target)
      setOpen(false)
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen((o) => !o)} className="relative" aria-label="Bildirişlər">
        <span className="text-lg">🔔</span>
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 bg-danger text-cream text-[10px] font-bold rounded-full min-w-4 h-4 px-1 flex items-center justify-center">
            {unread}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed sm:absolute inset-x-2 sm:inset-x-auto top-16 sm:top-auto right-auto sm:right-0 sm:mt-3 sm:w-96 bg-panel rounded-2xl border border-border shadow-2xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <p className="font-semibold text-[13.5px]">
              Bildirişlər{pendingCalls > 0 && <span className="ml-2 text-[11px] font-bold text-danger">{pendingCalls} gözləyən çağırış</span>}
            </p>
            {unread > 0 && (
              <button onClick={markAllRead} className="text-[11.5px] font-semibold text-burgundy">
                Hamısını oxu
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1 px-3 py-2 border-b border-border">
            {FILTERS.map(([v, l]) => (
              <button
                key={v}
                onClick={() => setFilter(v)}
                className={`px-2.5 py-0.5 rounded-full text-[10.5px] font-semibold border ${filter === v ? 'bg-ink text-cream border-ink' : 'text-muted border-border'}`}
              >
                {l}
              </button>
            ))}
            <button onClick={clearRead} className="ml-auto text-[10.5px] font-semibold text-danger">Oxunmuşları sil</button>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {visible.length === 0 && <p className="text-[12.5px] text-muted px-4 py-6 text-center">{items.length ? 'Bu filtrə uyğun bildiriş yoxdur' : 'Hələ bildiriş yoxdur'}</p>}
            {visible.map((n) => (
              <div key={n.id} className={`relative group border-b border-border/60 last:border-0 ${!n.isRead ? 'bg-gold/10' : ''}`} data-testid="notification-item">
                <button onClick={() => handleItemClick(n)} className="w-full text-left px-4 pt-3 pb-2 hover:bg-blush/40 flex gap-2.5">
                  <span className="text-base leading-none mt-0.5">{TYPE_ICON[n.type] || '🔔'}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[12.5px] font-semibold text-ink">{n.title}</span>
                    {n.body && <span className="block text-[11.5px] text-muted mt-0.5">{n.body}</span>}
                    <span className="block text-[10.5px] text-muted mt-1">{timeAgo(n.created_at)}</span>
                  </span>
                  {!n.isRead && <span className="w-2 h-2 rounded-full bg-burgundy mt-1.5 shrink-0" />}
                </button>
                {HANDLEABLE.includes(n.type) && <HandlePanel n={n} />}
                <button
                  aria-label="Sil"
                  onClick={() => remove(n.id)}
                  className="absolute top-2 right-2 w-5 h-5 rounded-full text-[11px] text-muted hover:text-danger hover:bg-white opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default NotificationBell
