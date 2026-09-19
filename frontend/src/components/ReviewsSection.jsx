import { useEffect, useState } from 'react'
import { reviewsApi } from '../lib/api'
import { useT } from '../lib/i18n'

// Menyu səhifəsinin aşağısında admin tərəfindən təsdiqlənmiş rəylər + orta reytinq.
function ReviewsSection() {
  const t = useT()
  const [data, setData] = useState(null)

  useEffect(() => {
    reviewsApi.publicList().then(setData).catch(() => {})
  }, [])

  if (!data || data.count === 0) return null

  return (
    <section className="px-5 md:px-8 pt-8">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="font-display text-[18px] font-semibold">{t('reviews_title')}</h2>
        <p className="text-[13px] font-semibold text-burgundy">★ {data.average.toFixed(1)} <span className="text-muted font-normal">({data.count})</span></p>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 snap-x" style={{ scrollbarWidth: 'none' }}>
        {data.reviews.slice(0, 6).map((r) => (
          <figure key={r.id} className="snap-start shrink-0 w-64 bg-panel border border-border/60 rounded-2xl p-4">
            <p className="text-gold text-[13px] tracking-tight mb-1.5">{'★'.repeat(r.rating)}<span className="text-border">{'★'.repeat(5 - r.rating)}</span></p>
            {r.comment && <blockquote className="text-[13px] text-ink/80 leading-snug line-clamp-4">{r.comment}</blockquote>}
            <figcaption className="text-[11.5px] font-semibold text-muted mt-2">{r.customer_name}</figcaption>
          </figure>
        ))}
      </div>
    </section>
  )
}

export default ReviewsSection
