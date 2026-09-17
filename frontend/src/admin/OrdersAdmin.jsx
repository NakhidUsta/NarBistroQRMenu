import { useEffect } from 'react'
import { useOrderStore } from '../store/orderStore'
import { useUiStore } from '../store/uiStore'

const STATUS_FLOW = ['NEW', 'CONFIRMED', 'PREPARING', 'READY', 'DELIVERED', 'COMPLETED']
const STATUS_LABELS = {
  NEW: 'Yeni', CONFIRMED: 'Təsdiqləndi', PREPARING: 'Hazırlanır',
  READY: 'Hazırdır', DELIVERED: 'Çatdırıldı', COMPLETED: 'Tamamlandı', CANCELLED: 'Ləğv edildi',
}
const STATUS_COLORS = {
  NEW: 'bg-gold/20 text-ink', CONFIRMED: 'bg-burgundy/10 text-burgundy', PREPARING: 'bg-burgundy/20 text-burgundy',
  READY: 'bg-success/15 text-success', DELIVERED: 'bg-success/25 text-success', COMPLETED: 'bg-ink/10 text-ink',
  CANCELLED: 'bg-danger/10 text-danger',
}

function OrdersAdmin() {
  const orders = useOrderStore((s) => s.orders)
  const fetchOrders = useOrderStore((s) => s.fetchOrders)
  const changeStatus = useOrderStore((s) => s.changeStatus)
  const showToast = useUiStore((s) => s.showToast)

  useEffect(() => {
    fetchOrders()
  }, [])

  async function advance(order) {
    const idx = STATUS_FLOW.indexOf(order.status)
    const next = STATUS_FLOW[idx + 1]
    if (!next) return
    try {
      await changeStatus(order.id, next)
    } catch (err) {
      showToast(err.response?.data?.error || 'Status yenilənmədi', 'error')
    }
  }

  async function cancel(order) {
    if (!confirm('Sifarişi ləğv etmək istədiyinizə əminsiniz?')) return
    await changeStatus(order.id, 'CANCELLED')
  }

  return (
    <div>
      <h1 className="font-display text-[24px] font-semibold mb-5">Sifarişlər</h1>
      <div className="flex flex-col gap-3">
        {orders.map((order) => {
          const idx = STATUS_FLOW.indexOf(order.status)
          const nextLabel = STATUS_LABELS[STATUS_FLOW[idx + 1]]
          const isFinal = order.status === 'COMPLETED' || order.status === 'CANCELLED'
          return (
            <div key={order.id} className="bg-panel rounded-2xl border border-border/60 p-4 flex flex-col gap-3">
              <div className="flex items-center gap-4 flex-wrap">
                <div className="w-14 shrink-0">
                  <p className="font-display text-[18px] font-bold text-burgundy">#{order.id}</p>
                  <p className="text-[11px] text-muted">{new Date(order.created_at).toLocaleTimeString('az-AZ', { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
                <div className="flex-1 min-w-[140px]">
                  <p className="font-semibold text-[14px]">{order.customer_name}</p>
                  <p className="text-[12px] text-muted">{order.phone} {order.table_id ? `· Masa #${order.table_id}` : '· Masasız'}</p>
                </div>
                <p className="font-display text-[16px] font-bold shrink-0">{Number(order.total).toFixed(2)} ₼</p>
                <span className={`shrink-0 px-3 py-1.5 rounded-full text-[11.5px] font-bold ${STATUS_COLORS[order.status]}`}>
                  {STATUS_LABELS[order.status]}
                </span>
              </div>
              {!isFinal && (
                <div className="flex gap-2 justify-end border-t border-border/60 pt-3">
                  {nextLabel && (
                    <button onClick={() => advance(order)} className="text-[12px] font-semibold bg-ink text-cream rounded-full px-3.5 py-2">
                      → {nextLabel}
                    </button>
                  )}
                  <button onClick={() => cancel(order)} className="text-[12px] font-semibold text-danger px-2">Ləğv et</button>
                </div>
              )}
            </div>
          )
        })}
        {orders.length === 0 && <p className="text-muted text-[13.5px]">Hələ sifariş yoxdur</p>}
      </div>
    </div>
  )
}

export default OrdersAdmin
