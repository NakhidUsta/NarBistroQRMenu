import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMyOrdersStore } from '../store/myOrdersStore'
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

function MyOrders() {
  const t = useT()
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
    <div className="px-5 pt-6 pb-28">
      <h1 className="font-display text-[24px] font-semibold mb-5">{t('orders_title')}</h1>
      {!loading && orders.length === 0 ? (
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
