import { useEffect, useRef, useState } from 'react'
import { useOrderStore } from '../store/orderStore'
import { useUiStore } from '../store/uiStore'

const FILTER_STATUSES = ['NEW', 'CONFIRMED', 'PREPARING', 'READY', 'DELIVERED', 'COMPLETED', 'CANCELLED']

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

  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [date, setDate] = useState('')
  const debounce = useRef(null)

  // Filtr dəyişəndə (axtarış mətni üçün qısa gecikmə ilə) serverdən yenidən yüklə
  useEffect(() => {
    clearTimeout(debounce.current)
    debounce.current = setTimeout(() => {
      fetchOrders({ ...(q.trim() && { q: q.trim() }), ...(status && { status }), ...(date && { date }) })
    }, q ? 300 : 0)
    return () => clearTimeout(debounce.current)
  }, [q, status, date])

  async function advance(order) {
    const idx = STATUS_FLOW.indexOf(order.status)
    const next = STATUS_FLOW[idx + 1]
    if (!next) return
    try {
      await changeStatus(order.id, next)
      if (status) fetchOrders()
    } catch (err) {
      showToast(err.response?.data?.error || 'Status yenilənmədi', 'error')
    }
  }

  async function cancel(order) {
    if (!confirm('Sifarişi ləğv etmək istədiyinizə əminsiniz?')) return
    await changeStatus(order.id, 'CANCELLED')
    if (status) fetchOrders()
  }

  const filtered = q || status || date

  return (
    <div>
      <h1 className="font-display text-[24px] font-semibold mb-4">Sifarişlər</h1>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Axtar: sifariş №, masa, müştəri, telefon"
          className="flex-1 min-w-[220px] bg-panel border border-border rounded-full px-4 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-burgundy/30"
        />
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="bg-panel border border-border rounded-full px-3 py-2 text-[13px]"
        />
        {filtered && (
          <button onClick={() => { setQ(''); setStatus(''); setDate('') }} className="text-[12.5px] font-semibold text-burgundy px-2">
            Təmizlə
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5 mb-5">
        {['', ...FILTER_STATUSES].map((s) => (
          <button
            key={s || 'all'}
            onClick={() => setStatus(s)}
            className={`px-3 py-1 rounded-full text-[11.5px] font-semibold border ${
              status === s ? 'bg-ink text-cream border-ink' : 'bg-panel text-muted border-border'
            }`}
          >
            {s ? STATUS_LABELS[s] : 'Hamısı'}
          </button>
        ))}
      </div>
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
                  <p className="text-[11px] text-muted">
                    {new Date(order.created_at).toLocaleDateString('az-AZ', { day: '2-digit', month: '2-digit' })}{' '}
                    {new Date(order.created_at).toLocaleTimeString('az-AZ', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <div className="flex-1 min-w-[140px]">
                  <p className="font-semibold text-[14px]">{order.customer_name}</p>
                  <p className="text-[12px] text-muted">{order.phone} · <span className="font-semibold text-burgundy">{order.table_label || 'Masasız'}</span></p>
                </div>
                <p className="font-display text-[16px] font-bold shrink-0">{Number(order.total).toFixed(2)} ₼</p>
                <span className={`shrink-0 px-3 py-1.5 rounded-full text-[11.5px] font-bold ${STATUS_COLORS[order.status]}`}>
                  {STATUS_LABELS[order.status]}
                </span>
              </div>
              {(order.items?.length > 0 || order.note) && (
                <div className="border-t border-border/60 pt-2.5 text-[12.5px]">
                  {order.items?.map((i, idx) => (
                    <p key={idx}><span className="font-bold">{i.quantity}×</span> {i.name} <span className="text-muted">({Number(i.price_at_order).toFixed(2)} ₼)</span></p>
                  ))}
                  {order.note && <p className="mt-1.5 bg-gold/20 rounded-md px-2 py-1">📝 {order.note}</p>}
                  {Number(order.discount) > 0 && <p className="mt-1 text-success font-semibold">Promo {order.promo_code}: −{Number(order.discount).toFixed(2)} ₼</p>}
                  {(Number(order.service_fee) > 0 || Number(order.vat) > 0 || Number(order.delivery_fee) > 0) && (
                    <p className="mt-1 text-muted">
                      {Number(order.service_fee) > 0 && `Servis ${Number(order.service_fee).toFixed(2)} · `}
                      {Number(order.vat) > 0 && `ƏDV ${Number(order.vat).toFixed(2)} · `}
                      {Number(order.delivery_fee) > 0 && `Çatdırılma ${Number(order.delivery_fee).toFixed(2)}`}
                    </p>
                  )}
                </div>
              )}
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
        {orders.length === 0 && <p className="text-muted text-[13.5px]">{filtered ? 'Bu filtrə uyğun sifariş tapılmadı' : 'Hələ sifariş yoxdur'}</p>}
      </div>
    </div>
  )
}

export default OrdersAdmin
