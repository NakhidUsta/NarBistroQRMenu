import { useEffect } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useOrderStore } from '../store/orderStore'
import { publicSocket } from '../lib/socket'
import { useT } from '../lib/i18n'
import Button from '../components/Button'

const STEP_KEYS = [
  { key: 'NEW', labelKey: 'order_status_new' },
  { key: 'CONFIRMED', labelKey: 'order_status_confirmed' },
  { key: 'PREPARING', labelKey: 'order_status_preparing' },
  { key: 'READY', labelKey: 'order_status_ready' },
  { key: 'DELIVERED', labelKey: 'order_status_delivered' },
]

function OrderStatus() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const order = useOrderStore((s) => s.currentOrder)
  const fetchOrder = useOrderStore((s) => s.fetchOrder)
  const t = useT()

  useEffect(() => {
    fetchOrder(id, token)
    if (!publicSocket.connected) publicSocket.connect()
    publicSocket.emit('join-order', id)
  }, [id])

  if (!order) {
    return (
      <div className="px-5 pt-24 text-center">
        <p className="text-muted">...</p>
      </div>
    )
  }

  const isCancelled = order.status === 'CANCELLED'
  const currentIndex = STEP_KEYS.findIndex((s) => s.key === order.status)

  return (
    <div className="px-5 pb-10 pt-6">
      <h1 className="font-display text-[22px] font-semibold mb-1">{t('order_number')} #{order.id}</h1>
      <p className="text-[13px] text-muted mb-6">
        {order.customer_name} · {new Date(order.created_at).toLocaleString('az-AZ')}
      </p>

      {isCancelled ? (
        <div className="bg-danger/10 text-danger rounded-2xl px-5 py-4 text-center font-semibold mb-6">
          {t('order_cancelled')}
        </div>
      ) : (
        <div className="bg-panel rounded-2xl p-5 border border-border/60 mb-6">
          {STEP_KEYS.map((step, i) => {
            const done = i <= currentIndex
            return (
              <div key={step.key} className="flex gap-3 items-start">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold ${
                      done ? 'bg-burgundy text-cream' : 'bg-blush text-muted'
                    }`}
                  >
                    {done ? '✓' : i + 1}
                  </div>
                  {i < STEP_KEYS.length - 1 && (
                    <div className={`w-[2px] h-10 ${i < currentIndex ? 'bg-burgundy' : 'bg-border'}`} />
                  )}
                </div>
                <div className="pb-8 pt-0.5">
                  <p className={`text-[14px] font-semibold ${done ? 'text-ink' : 'text-muted'}`}>{t(step.labelKey)}</p>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="bg-panel rounded-2xl p-5 border border-border/60 mb-6">
        <h2 className="text-[12px] uppercase tracking-wider font-bold text-muted mb-3">{t('order_details')}</h2>
        <div className="flex flex-col gap-2 mb-3">
          {order.items?.map((item) => (
            <div key={item.id} className="flex justify-between text-[13.5px]">
              <span>{item.quantity}× {item.name}</span>
              <span className="font-semibold">{(item.price_at_order * item.quantity).toFixed(2)} ₼</span>
            </div>
          ))}
        </div>
        <div className="pt-3 border-t border-border flex flex-col gap-1.5">
          {Number(order.discount) > 0 && (
            <>
              <div className="flex justify-between text-[13px] text-muted">
                <span>{t('subtotal')}</span>
                <span>{Number(order.subtotal).toFixed(2)} ₼</span>
              </div>
              <div className="flex justify-between text-[13px] text-success font-semibold">
                <span>{t('discount')} {order.promo_code ? `(${order.promo_code})` : ''}</span>
                <span>−{Number(order.discount).toFixed(2)} ₼</span>
              </div>
            </>
          )}
          <div className="flex justify-between">
            <span className="font-semibold">{t('total')}</span>
            <span className="font-display font-bold text-burgundy">{Number(order.total).toFixed(2)} ₼</span>
          </div>
        </div>
      </div>

      <Button to="/menyu" variant="outline" className="w-full">{t('back_to_menu')}</Button>
    </div>
  )
}

export default OrderStatus
