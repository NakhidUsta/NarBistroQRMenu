import { useEffect, useState } from 'react'
import { reviewsApi } from '../lib/api'
import { useT } from '../lib/i18n'
import { useUiStore } from '../store/uiStore'

// Sifariş hazır/təhvil verildikdən sonra bir dəfə rəy yazmağa imkan verir (sifariş tokeni ilə).
function ReviewForm({ orderId, token, status }) {
  const t = useT()
  const showToast = useUiStore((s) => s.showToast)
  const [state, setState] = useState(null) // { can_review, reviewed }
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    reviewsApi.orderStatus(orderId, token).then(setState).catch(() => setState(null))
  }, [orderId, token, status])

  if (done) {
    return <div className="bg-success/10 text-success rounded-2xl px-5 py-4 text-[13px] font-semibold mb-6">{t('review_thanks')}</div>
  }
  if (!state?.can_review) return null

  async function submit(e) {
    e.preventDefault()
    if (!rating) return
    setSending(true)
    try {
      await reviewsApi.create(orderId, token, { rating, comment })
      setDone(true)
    } catch (err) {
      showToast(err.response?.data?.error || 'Xəta baş verdi', 'error')
    } finally {
      setSending(false)
    }
  }

  return (
    <form onSubmit={submit} className="bg-panel rounded-2xl p-5 border border-border/60 mb-6">
      <h2 className="text-[12px] uppercase tracking-wider font-bold text-muted mb-3">{t('rate_order')}</h2>
      <div className="flex gap-1 mb-3" role="radiogroup">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={rating === n}
            aria-label={`${n}`}
            onClick={() => setRating(n)}
            className={`text-[30px] leading-none transition-transform active:scale-90 ${n <= rating ? 'text-gold' : 'text-border'}`}
          >
            ★
          </button>
        ))}
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        maxLength={1000}
        rows={2}
        placeholder={t('review_placeholder')}
        className="w-full bg-cream border border-border rounded-xl px-4 py-3 text-[14px] mb-3 focus:outline-none focus:ring-2 focus:ring-burgundy/30"
      />
      <button type="submit" disabled={!rating || sending} className="w-full bg-btn text-cream rounded-full py-3 text-[14px] font-semibold disabled:opacity-40">
        {sending ? t('sending') : t('submit_review')}
      </button>
    </form>
  )
}

export default ReviewForm
