import { useState } from 'react'
import { useNotificationStore } from '../store/notificationStore'
import { useUiStore } from '../store/uiStore'

// Zəng menyusu (NotificationBell) və bildirişlər səhifəsi (NotificationsAdmin) üçün ortaq hissələr

export const TYPE_ICON = {
  order_created: '🧾',
  call_waiter: '🔔',
  request_bill: '💳',
  low_stock: '📦',
  out_of_stock: '🚫',
  system_error: '⚠️',
}

export const HANDLEABLE = ['call_waiter', 'request_bill']
const STOCK_TYPES = ['low_stock', 'out_of_stock']

export const FILTERS = [
  ['all', 'Hamısı'],
  ['unread', 'Oxunmamış'],
  ['order_created', 'Sifariş'],
  ['call_waiter', 'Ofisiant'],
  ['request_bill', 'Hesab'],
  ['stock', 'Stok'],
  ['system_error', 'Sistem'],
]

// Bildirişin aid olduğu səhifə (klikləyəndə)
export const TARGET = { order: '/admin/orders', table: '/admin/tables', product: '/admin/menu' }

export function timeAgo(dateStr) {
  const diffMs = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'indicə'
  if (mins < 60) return `${mins} dəq əvvəl`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} saat əvvəl`
  return new Date(dateStr).toLocaleDateString('az-AZ')
}

export function matches(n, filter) {
  if (filter === 'all') return true
  if (filter === 'unread') return !n.isRead
  if (filter === 'stock') return STOCK_TYPES.includes(n.type)
  return n.type === filter
}

// Çağırış / hesab sorğusunun iş statusu və [Qəbul et] / [Həll edildi] düymələri
export function HandlePanel({ n, className = 'px-4 pb-3 pl-[42px]' }) {
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
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`} data-testid="handle-panel">
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
