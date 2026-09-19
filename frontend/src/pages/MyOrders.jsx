import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMyOrdersStore } from '../store/myOrdersStore'
import { useOutboxStore } from '../store/outboxStore'
import { useUiStore } from '../store/uiStore'
import { ordersApi } from '../lib/api'
import { useT } from '../lib/i18n'
import Button from '../components/Button'

const STATUS_KEY = {
  NEW: 'order_status_new',
  CONFIRMED: 'order_status_confirmed',
  PREPARING: 'order_status_preparing',
  READY: 'order_status_ready',
  DELIVERED: 'order_status_delivered',
  COMPLETED: 'order_status_delivered',
  CANCELLED: 'order_cancelled',
}

// Offline növbədəki (hələ göndərilməmiş) sifarişlər: gözləyir / qiymət dəyişib / rədd edilib
function OutboxList() {
  const t = useT()
  const items = useOutboxStore((s) => s.items)
  const flush = useOutboxStore((s) => s.flush)
  const confirmPrice = useOutboxStore((s) => s.confirmPrice)
  const discard = useOutboxStore((s) => s.discard)
  const showToast = useUiStore((s) => s.showToast)
  if (!items.length) return null

  const notify = (sent) => sent.length && showToast(t('outbox_sent'))

  return (
    <section className="mb-6" aria-label={t('outbox_title')}>
      <h2 className="text-[12px] uppercase tracking-wider font-bold text-muted mb-2">{t('outbox_title')}</h2>
      <div className="flex flex-col gap-3">
        {items.map((i) => (
          <div key={i.id} className="bg-panel rounded-2xl border border-gold/60 p-4" data-testid="outbox-item">
            <div className="flex items-center justify-between">
              <p className="text-[13px] text-muted">{i.summary?.count} {t('items_count')}</p>
              <p className="font-display font-bold text-[15px]">{Number(i.quote?.total ?? i.summary?.total ?? 0).toFixed(2)} ₼</p>
            </div>
            {i.status === 'pending' && (
              <div className="flex items-center justify-between mt-2">
                <p className="text-[12px] font-semibold text-burgundy">⏳ {t('outbox_pending')}</p>
                <button type="button" onClick={async () => notify(await flush())} className="text-[12px] font-bold text-burgundy underline">{t('outbox_send_now')}</button>
              </div>
            )}
            {i.status === 'needs_confirm' && (
              <div className="mt-2">
                <p className="text-[12.5px] font-semibold text-danger mb-1.5">{t('price_changed_title')}: <span className="line-through text-muted">{Number(i.quote.previous_total).toFixed(2)}</span> → {Number(i.quote.total).toFixed(2)} ₼</p>
                <div className="flex gap-2">
                  <Button className="flex-1" onClick={async () => notify(await confirmPrice(i.id))}>{t('price_confirm')}</Button>
                  <Button variant="outline" className="flex-1" onClick={() => discard(i.id)}>{t('outbox_discard')}</Button>
                </div>
              </div>
            )}
            {i.status === 'failed' && (
              <div className="flex items-center justify-between mt-2 gap-3">
                <p className="text-[12.5px] font-semibold text-danger">{t('outbox_failed')}: {i.error}</p>
                <button type="button" onClick={() => discard(i.id)} className="text-[12px] font-bold text-danger underline shrink-0">{t('outbox_discard')}</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

function MyOrders() {
  const t = useT()
  const outboxCount = useOutboxStore((s) => s.items.length)
  const refs = useMyOrdersStore((s) => s.refs)
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    Promise.all(refs.map((r) => ordersApi.get(r.id, r.token).then((o) => ({ ...o, token: r.token })).catch(() => null)))
      .then((list) => {
        if (!cancelled) setOrders(list.filter(Boolean))
      })
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [refs])

  return (
    <div className="px-5 md:px-8 md:max-w-3xl md:mx-auto pt-6 pb-28 md:pb-16">
      <h1 className="font-display text-[24px] font-semibold mb-5">{t('orders_title')}</h1>
      <OutboxList />
      {!loading && orders.length === 0 && outboxCount === 0 ? (
        <div className="text-center py-16">
          <p className="text-[13.5px] text-muted mb-5">{t('orders_empty')}</p>
          <Button to="/menyu">{t('back_to_menu')}</Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {orders.map((o) => (
            <Link
              key={o.id}
              to={`/order/${o.id}?token=${o.token}`}
              className="bg-panel rounded-2xl border border-border/60 p-4 flex items-center justify-between"
            >
              <div>
                <p className="font-display font-bold text-[16px] text-burgundy">#{o.id}</p>
                <p className="text-[12px] text-muted">{new Date(o.created_at).toLocaleString('az-AZ')}</p>
              </div>
              <div className="text-right">
                <p className="font-display font-bold text-[15px]">{Number(o.total).toFixed(2)} ₼</p>
                <p className="text-[12px] font-semibold text-burgundy">{t(STATUS_KEY[o.status] || 'order_status_new')}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

export default MyOrders
