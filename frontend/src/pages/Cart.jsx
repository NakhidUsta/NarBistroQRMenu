import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCartStore } from '../store/cartStore'
import { useMenuStore } from '../store/menuStore'
import { useTableSessionStore } from '../store/tableSessionStore'
import { useRestaurantStore } from '../store/restaurantStore'
import { useMyOrdersStore } from '../store/myOrdersStore'
import { useUiStore } from '../store/uiStore'
import { ordersApi, resolveUploadUrl } from '../lib/api'
import { useT } from '../lib/i18n'
import Button from '../components/Button'

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

  async function placeOrder() {
    setSubmitting(true)
    try {
      const order = await ordersApi.create({
        table_code: table?.code,
        customer_name: form.customer_name,
        phone: form.phone,
        note: form.note,
        promo_code: form.promo_code.trim() || undefined,
        items: items.map((i) => ({ product_id: i.product_id, quantity: i.quantity })),
      })
      addMyOrder(order.id, order.access_token)
      clear()
      navigate(`/order/${order.id}?token=${order.access_token}`)
    } catch (err) {
      showToast(err.response?.data?.error || 'Sifariş göndərilərkən xəta baş verdi', 'error')
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
    <div className="px-5 pb-32">
      <div className="pt-6 pb-4">
        <h1 className="font-display text-[24px] font-semibold">{t('cart_title')}</h1>
      </div>

      {blocked && (
        <div className="mb-4 bg-danger/10 border border-danger/20 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
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

      <div className="flex flex-col gap-3 mb-6">
        {items.map((item) => {
          const unavailable = unavailableIds.includes(item.product_id)
          return (
            <div
              key={item.product_id}
              className={`flex gap-3 bg-panel rounded-2xl p-3 border ${unavailable ? 'border-danger/40 opacity-70' : 'border-border/60'}`}
            >
              <img src={resolveUploadUrl(item.image_url)} alt={item.name} className="w-16 h-16 rounded-xl object-cover" />
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

      {!confirming ? (
        <>
          <div className="flex items-center justify-between py-4 border-t border-border mb-4">
            <span className="text-[15px] font-semibold text-ink">{t('total')}</span>
            <span className="font-display text-[20px] font-bold text-burgundy">{total.toFixed(2)} ₼</span>
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
          </div>

          <div className="flex items-center justify-between py-3 mt-1 border-t border-border">
            <span className="text-[15px] font-semibold text-ink">{t('total')}</span>
            <span className="font-display text-[20px] font-bold text-burgundy">{total.toFixed(2)} ₼</span>
          </div>

          <Button type="submit" variant="accent" disabled={submitting || blocked} className="w-full">
            {submitting ? t('sending') : t('confirm_order')}
          </Button>
        </form>
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
            <div className="flex justify-between border-t border-border pt-3 mb-5">
              <span className="font-semibold">{t('total')}</span>
              <span className="font-display font-bold text-burgundy">{total.toFixed(2)} ₼</span>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowModal(false)} disabled={submitting}>
                {t('cancel')}
              </Button>
              <Button variant="accent" className="flex-1" onClick={placeOrder} disabled={submitting}>
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
