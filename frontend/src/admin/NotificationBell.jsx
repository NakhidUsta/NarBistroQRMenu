import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useNotificationStore } from '../store/notificationStore'

const TYPE_ICON = {
  order_created: '🧾',
  call_waiter: '🔔',
  request_bill: '💳',
  low_stock: '📦',
}

function timeAgo(dateStr) {
  const diffMs = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'indicə'
  if (mins < 60) return `${mins} dəq əvvəl`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} saat əvvəl`
  return new Date(dateStr).toLocaleDateString('az-AZ')
}

function NotificationBell() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const items = useNotificationStore((s) => s.items)
  const fetchAll = useNotificationStore((s) => s.fetchAll)
  const markRead = useNotificationStore((s) => s.markRead)
  const markAllRead = useNotificationStore((s) => s.markAllRead)
  const unread = items.filter((n) => !n.isRead).length

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
    if (n.entity_type === 'order' && n.entity_id) {
      navigate('/admin/orders')
      setOpen(false)
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen((o) => !o)} className="relative">
        <span className="text-lg">🔔</span>
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 bg-danger text-cream text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
            {unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-3 w-80 bg-panel rounded-2xl border border-border shadow-2xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <p className="font-semibold text-[13.5px]">Bildirişlər</p>
            {unread > 0 && (
              <button onClick={markAllRead} className="text-[11.5px] font-semibold text-burgundy">
                Hamısını oxu
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 && <p className="text-[12.5px] text-muted px-4 py-6 text-center">Hələ bildiriş yoxdur</p>}
            {items.map((n) => (
              <button
                key={n.id}
                onClick={() => handleItemClick(n)}
                className={`w-full text-left px-4 py-3 border-b border-border/60 last:border-0 hover:bg-blush/40 flex gap-2.5 ${
                  !n.isRead ? 'bg-gold/10' : ''
                }`}
              >
                <span className="text-base leading-none mt-0.5">{TYPE_ICON[n.type] || '🔔'}</span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[12.5px] font-semibold text-ink">{n.title}</span>
                  {n.body && <span className="block text-[11.5px] text-muted mt-0.5">{n.body}</span>}
                  <span className="block text-[10.5px] text-muted mt-1">{timeAgo(n.created_at)}</span>
                </span>
                {!n.isRead && <span className="w-2 h-2 rounded-full bg-burgundy mt-1.5 shrink-0" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default NotificationBell
