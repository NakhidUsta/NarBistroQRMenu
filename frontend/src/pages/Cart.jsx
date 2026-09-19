import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCartStore } from '../store/cartStore'
import { useMenuStore } from '../store/menuStore'
import { useTableSessionStore } from '../store/tableSessionStore'
import { useRestaurantStore } from '../store/restaurantStore'
import { useMyOrdersStore } from '../store/myOrdersStore'
import { useOutboxStore, newRequestId } from '../store/outboxStore'
import { useUiStore } from '../store/uiStore'
import { ordersApi } from '../lib/api'
import ResponsiveImage from '../components/ResponsiveImage'
import { useT } from '../lib/i18n'
import Button from '../components/Button'
import PriceBreakdown from '../components/PriceBreakdown'

const inputCls =
  'w-full bg-panel border border-border rounded-xl px-4 py-3 text-[14px] focus:outline-none focus:ring-2 focus:ring-burgundy/30'

function Cart() {
  const navigate = useNavigate()
  const items = useCartStore((s) => s.items)
  const updateQuantity = useCartStore((s) => s.updateQuantity)
  const removeItem = useCartStore((s) => s.removeItem)
  const removeMany = useCartStore((s) => s.removeMany)
  const syncPrices = useCartStore((s) => s.syncPrices)
  const clear = useCartStore((s) => s.clear)
  const products = useMenuStore((s) => s.products)
  const menuStatus = useMenuStore((s) => s.status)
  const table = useTableSessionStore((s) => s.table)
  const restaurant = useRestaurantStore((s) => s.restaurant)
  const addMyOrder = useMyOrdersStore((s) => s.add)
  const showToast = useUiStore((s) => s.showToast)
  const t = useT()
  const canOrder = !!table || !!restaurant?.allow_tableless_orders

  const [form, setForm] = useState({ customer_name: '', phone: '', note: '', promo_code: '' })
  const [submitting, setSubmitting] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [priceChange, setPriceChange] = useState(null) // { previous_total, total } — backend qiymət dəyişikliyi aşkar etdi
  // Bir checkout cəhdinə bir ID: şəbəkə kəsilib təkrar göndərilsə belə backend ikinci sifariş yaratmır
  const requestId = useRef(newRequestId())

  // Menyu canlı yenilənəndə (socket) qiymət dəyişikliyini səbətə tətbiq et və xəbər ver.
  useEffect(() => {
    if (products.length && syncPrices(products)) showToast(t('price_changed'))
  }, [products])

  const unavailableIds = menuStatus === 'ready'
    ? items.filter((i) => {
        const p = products.find((x) => x.id === i.product_id)
        return !p || !p.is_available
      }).map((i) => i.product_id)
    : []

  const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0)
  const blocked = unavailableIds.length > 0

  // Yekun hesab (endirim, servis, ƏDV, çatdırılma) backend-dən gəlir; yerli cəm yalnız yüklənənə qədər ehtiyat kimi göstərilir.
  const [quote, setQuote] = useState(null)
  const quoteKey = JSON.stringify([items.map((i) => [i.product_id, i.quantity]), form.promo_code.trim(), table?.code])
  useEffect(() => {
    if (!items.length) return undefined
    let stale = false
    const timer = setTimeout(() => {
      ordersApi
        .quote({
          table_code: table?.code,
          promo_code: form.promo_code.trim() || undefined,
          items: items.map((i) => ({ product_id: i.product_id, quantity: i.quantity })),
        })
        .then((q) => !stale && setQuote(q))
        .catch(() => !stale && setQuote(null))
    }, 350)
    return () => {
      stale = true
      clearTimeout(timer)
    }
  }, [quoteKey])
  const summary = quote || { subtotal: total, discount: 0, service_fee: 0, vat: 0, delivery_fee: 0, total }

  function buildPayload(expectedTotal) {
    return {
      table_code: table?.code,
      customer_name: form.customer_name,
      phone: form.phone,
      note: form.note,
      promo_code: form.promo_code.trim() || undefined,
      items: items.map((i) => ({ product_id: i.product_id, quantity: i.quantity })),
      // müştərinin gördüyü məbləğ — backend cari məbləğlə fərqlənirsə sifariş yaratmayıb bizə xəbər verir
      expected_total: expectedTotal ?? (quote && !quote.promo_error ? Number(quote.total) : undefined),
    }
  }

  // İnternet yoxdur / sorğu şəbəkədə kəsildi: sifariş cihazda saxlanılır, bağlantı qayıdanda avtomatik göndərilir
  function queueOrder(payload) {
    useOutboxStore.getState().enqueue(requestId.current, payload, { count: items.reduce((n, i) => n + i.quantity, 0), total: Number(summary.total) })
    requestId.current = newRequestId()
    clear()
    showToast(t('order_queued'))
    navigate('/orders')
  }

  async function placeOrder(expectedTotal) {
    const payload = buildPayload(expectedTotal)
    if (!navigator.onLine) {
      setShowModal(false)
      queueOrder(payload)
      return
    }
    setSubmitting(true)
    try {
      const order = await ordersApi.create({ ...payload, client_request_id: requestId.current })
      requestId.current = newRequestId()
      addMyOrder(order.id, order.access_token)
      clear()
      navigate(`/order/${order.id}?token=${order.access_token}`)
    } catch (err) {
      const data = err.response?.data
      if (!err.response) {
        queueOrder(payload) // şəbəkə xətası: sorğu serverə çatmış ola bilər — eyni ID idempotency ilə qorunur
      } else if (err.response.status === 409 && data?.code === 'PRICE_CHANGED') {
        setPriceChange({ previous_total: data.previous_total, total: data.total })
        if (data.breakdown) setQuote((q) => ({ ...(q || {}), ...data.breakdown }))
      } else {
        showToast(data?.error || 'Sifariş göndərilərkən xəta baş verdi', 'error')
      }
    } finally {
      setSubmitting(false)
      setShowModal(false)
    }
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!items.length || blocked) return
    setShowModal(true)
  }

  if (!items.length) {
    return (
      <div className="px-5 pt-24 text-center pb-28">
        <p className="font-display text-xl text-ink mb-2">{t('cart_empty_title')}</p>
        <p className="text-[13.5px] text-muted mb-6">{t('cart_empty_body')}</p>
        <Button to="/menyu">{t('back_to_menu')}</Button>
      </div>
    )
  }

  return (
    <div className="px-5 pb-36 md:pb-16 md:max-w-5xl md:mx-auto md:px-8 md:grid md:grid-cols-[1fr_380px] md:gap-x-10 md:items-start">
      <div className="pt-6 pb-4 md:col-span-2">
        <h1 className="font-display text-[24px] font-semibold">{t('cart_title')}</h1>
      </div>

      {blocked && (
        <div className="mb-4 md:col-span-2 bg-danger/10 border border-danger/20 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
          <p className="text-[12.5px] font-semibold text-danger">{t('item_unavailable')}</p>
          <button
            type="button"
            onClick={() => removeMany(unavailableIds)}
            className="text-[12px] font-bold text-danger underline shrink-0"
          >
            {t('remove_unavailable')}
          </button>
        </div>
      )}

      <div className="flex flex-col gap-3 mb-6 md:col-start-1">
        {items.map((item) => {
          const unavailable = unavailableIds.includes(item.product_id)
          return (
            <div
              key={item.product_id}
              className={`flex gap-3 bg-panel rounded-2xl p-3 border ${unavailable ? 'border-danger/40 opacity-70' : 'border-border/60'}`}
            >
              <ResponsiveImage src={item.image_url} alt={item.name} thumb className="w-16 h-16 rounded-xl object-cover" />
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-[14.5px] truncate">{item.name}</h3>
                <p className="text-burgundy font-bold text-[13.5px]">{item.price.toFixed(2)} ₼</p>
                <div className="flex items-center gap-2.5 mt-1.5">
                  <button
                    type="button"
                    onClick={() => updateQuantity(item.product_id, item.quantity - 1)}
                    className="w-7 h-7 rounded-full bg-cream border border-border flex items-center justify-center font-semibold"
                  >
                    −
                  </button>
                  <span className="w-4 text-center text-[13.5px] font-semibold">{item.quantity}</span>
                  <button
                    type="button"
                    onClick={() => updateQuantity(item.product_id, item.quantity + 1)}
                    className="w-7 h-7 rounded-full bg-cream border border-border flex items-center justify-center font-semibold"
                  >
                    +
                  </button>
                  <button
                    type="button"
                    onClick={() => removeItem(item.product_id)}
                    className="ml-auto text-[12px] text-danger font-semibold"
                  >
                    {t('remove')}
                  </button>
                </div>
                <p className="text-[11.5px] text-muted mt-1">= {(item.price * item.quantity).toFixed(2)} ₼</p>
              </div>
            </div>
          )
        })}
      </div>

      <div className="md:col-start-2 md:sticky md:top-24 md:bg-panel md:rounded-2xl md:border md:border-border/60 md:p-6">
      {!confirming ? (
        <>
          <div className="py-4 border-t border-border mb-4 md:border-t-0 md:pt-0">
            <PriceBreakdown data={summary} />
          </div>
          {canOrder ? (
            <Button className="w-full" disabled={blocked} onClick={() => setConfirming(true)}>
              {t('continue')}
            </Button>
          ) : (
            <div className="bg-blush/60 border border-border rounded-xl px-4 py-3.5 text-center text-[13.5px] font-semibold text-ink">
              {t('tableless_blocked')}
            </div>
          )}
        </>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label className="text-[12.5px] font-semibold text-muted mb-1 block">{t('name_label')}</label>
            <input required value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} className={inputCls} placeholder="Ad Soyad" />
          </div>
          <div>
            <label className="text-[12.5px] font-semibold text-muted mb-1 block">{t('phone_label')}</label>
            <input required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inputCls} placeholder="+994 XX XXX XX XX" />
          </div>
          <div>
            <label className="text-[12.5px] font-semibold text-muted mb-1 block">{t('note_label')}</label>
            <textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className={inputCls} rows={2} placeholder={t('note_placeholder')} />
          </div>
          <div>
            <label className="text-[12.5px] font-semibold text-muted mb-1 block">{t('promo_label')}</label>
            <input value={form.promo_code} onChange={(e) => setForm({ ...form, promo_code: e.target.value.toUpperCase() })} className={`${inputCls} uppercase`} placeholder="Məs: XOSGEL10" />
            {quote?.promo_error && <p className="text-[12px] text-danger font-semibold mt-1">{quote.promo_error}</p>}
            {quote && !quote.promo_error && form.promo_code.trim() && Number(quote.discount) > 0 && (
              <p className="text-[12px] text-success font-semibold mt-1">−{Number(quote.discount).toFixed(2)} ₼</p>
            )}
          </div>

          <div className="py-3 mt-1 border-t border-border">
            <PriceBreakdown data={summary} />
          </div>

          <Button type="submit" variant="accent" disabled={submitting || blocked} className="w-full">
            {submitting ? t('sending') : t('confirm_order')}
          </Button>
        </form>
      )}
      </div>

      {priceChange && (
        <div className="fixed inset-0 z-50 bg-ink/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-4" role="dialog" aria-label={t('price_changed_title')}>
          <div className="bg-panel rounded-3xl w-full max-w-sm p-6 shadow-2xl">
            <h2 className="font-display text-[20px] font-semibold mb-1">{t('price_changed_title')}</h2>
            <p className="text-[13px] text-muted mb-4">{t('price_changed_body')}</p>
            <div className="flex justify-between items-baseline mb-1 text-[13px]">
              <span className="text-muted">{t('price_was')}</span>
              <span className="line-through text-muted">{Number(priceChange.previous_total).toFixed(2)} ₼</span>
            </div>
            <div className="flex justify-between items-baseline mb-5">
              <span className="text-[13px] font-semibold">{t('price_now')}</span>
              <span className="font-display text-[22px] font-bold text-burgundy">{Number(priceChange.total).toFixed(2)} ₼</span>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setPriceChange(null)}>{t('cancel')}</Button>
              <Button variant="accent" className="flex-1" onClick={() => { const total = priceChange.total; setPriceChange(null); placeOrder(total) }}>{t('price_confirm')}</Button>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 bg-ink/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
          <div className="bg-panel rounded-3xl w-full max-w-sm p-6 shadow-2xl">
            <h2 className="font-display text-[20px] font-semibold mb-1">{t('confirm_title')}</h2>
            <p className="text-[13px] text-muted mb-4">
              {table ? `${t('table_label')}: ${table.label} · ` : ''}{t('confirm_body')}
            </p>
            <div className="flex flex-col gap-1 mb-4 max-h-40 overflow-y-auto">
              {items.map((i) => (
                <div key={i.product_id} className="flex justify-between text-[13px]">
                  <span>{i.quantity}× {i.name}</span>
                  <span className="font-semibold">{(i.price * i.quantity).toFixed(2)} ₼</span>
                </div>
              ))}
            </div>
            <div className="border-t border-border pt-3 mb-5">
              <PriceBreakdown data={summary} />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowModal(false)} disabled={submitting}>
                {t('cancel')}
              </Button>
              <Button variant="accent" className="flex-1" onClick={() => placeOrder()} disabled={submitting}>
                {submitting ? t('sending') : t('confirm')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Cart
