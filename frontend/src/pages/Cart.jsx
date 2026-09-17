import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCartStore } from '../store/cartStore'
import { useTableSessionStore } from '../store/tableSessionStore'
import { useRestaurantStore } from '../store/restaurantStore'
import { useUiStore } from '../store/uiStore'
import { ordersApi, resolveUploadUrl } from '../lib/api'
import { useT } from '../lib/i18n'
import Button from '../components/Button'

function Cart() {
  const navigate = useNavigate()
  const items = useCartStore((s) => s.items)
  const updateQuantity = useCartStore((s) => s.updateQuantity)
  const removeItem = useCartStore((s) => s.removeItem)
  const clear = useCartStore((s) => s.clear)
  const table = useTableSessionStore((s) => s.table)
  const restaurant = useRestaurantStore((s) => s.restaurant)
  const showToast = useUiStore((s) => s.showToast)
  const t = useT()
  const canOrder = !!table || !!restaurant?.allow_tableless_orders

  const [form, setForm] = useState({ customer_name: '', phone: '', note: '', promo_code: '' })
  const [submitting, setSubmitting] = useState(false)
  const [confirming, setConfirming] = useState(false)

  const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!items.length) return
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
      clear()
      navigate(`/order/${order.id}?token=${order.access_token}`)
    } catch (err) {
      showToast(err.response?.data?.error || 'Sifariş göndərilərkən xəta baş verdi', 'error')
    } finally {
      setSubmitting(false)
      setConfirming(false)
    }
  }

  if (!items.length) {
    return (
      <div className="px-5 pt-24 text-center">
        <p className="font-display text-xl text-ink mb-2">{t('cart_empty_title')}</p>
        <p className="text-[13.5px] text-muted mb-6">{t('cart_empty_body')}</p>
        <Button to="/menyu">{t('back_to_menu')}</Button>
      </div>
    )
  }

  return (
    <div className="px-5 pb-10">
      <div className="flex items-center gap-3 pt-6 pb-4">
        <button type="button" onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-panel border border-border flex items-center justify-center">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <h1 className="font-display text-[22px] font-semibold">{t('cart_title')}</h1>
      </div>

      <div className="flex flex-col gap-3 mb-6">
        {items.map((item) => (
          <div key={item.product_id} className="flex gap-3 bg-panel rounded-2xl p-3 border border-border/60">
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
            </div>
          </div>
        ))}
      </div>

      {!confirming ? (
        <>
          <div className="flex items-center justify-between py-4 border-t border-border mb-4">
            <span className="text-[15px] font-semibold text-ink">{t('total')}</span>
            <span className="font-display text-[20px] font-bold text-burgundy">{total.toFixed(2)} ₼</span>
          </div>
          {canOrder ? (
            <Button className="w-full" onClick={() => setConfirming(true)}>
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
            <input
              required
              value={form.customer_name}
              onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
              className="w-full bg-panel border border-border rounded-xl px-4 py-3 text-[14px] focus:outline-none focus:ring-2 focus:ring-burgundy/30"
              placeholder="Ad Soyad"
            />
          </div>
          <div>
            <label className="text-[12.5px] font-semibold text-muted mb-1 block">{t('phone_label')}</label>
            <input
              required
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="w-full bg-panel border border-border rounded-xl px-4 py-3 text-[14px] focus:outline-none focus:ring-2 focus:ring-burgundy/30"
              placeholder="+994 XX XXX XX XX"
            />
          </div>
          <div>
            <label className="text-[12.5px] font-semibold text-muted mb-1 block">{t('note_label')}</label>
            <textarea
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              className="w-full bg-panel border border-border rounded-xl px-4 py-3 text-[14px] focus:outline-none focus:ring-2 focus:ring-burgundy/30"
              rows={2}
              placeholder={t('note_placeholder')}
            />
          </div>
          <div>
            <label className="text-[12.5px] font-semibold text-muted mb-1 block">{t('promo_label')}</label>
            <input
              value={form.promo_code}
              onChange={(e) => setForm({ ...form, promo_code: e.target.value.toUpperCase() })}
              className="w-full bg-panel border border-border rounded-xl px-4 py-3 text-[14px] uppercase focus:outline-none focus:ring-2 focus:ring-burgundy/30"
              placeholder="Məs: XOSGEL10"
            />
          </div>

          <div className="flex items-center justify-between py-3 mt-1 border-t border-border">
            <span className="text-[15px] font-semibold text-ink">{t('total')}</span>
            <span className="font-display text-[20px] font-bold text-burgundy">{total.toFixed(2)} ₼</span>
          </div>

          <Button type="submit" variant="accent" disabled={submitting} className="w-full">
            {submitting ? t('sending') : t('confirm_order')}
          </Button>
        </form>
      )}
    </div>
  )
}

export default Cart
