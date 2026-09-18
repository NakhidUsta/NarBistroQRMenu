import { useEffect, useState } from 'react'
import { reviewsApi } from '../lib/api'
import { useUiStore } from '../store/uiStore'

const Stars = ({ n }) => <span className="text-gold tracking-tight">{'★'.repeat(n)}<span className="text-border">{'★'.repeat(5 - n)}</span></span>

function ReviewsAdmin() {
  const showToast = useUiStore((s) => s.showToast)
  const [reviews, setReviews] = useState([])
  const [filter, setFilter] = useState('pending')

  async function load() {
    setReviews(await reviewsApi.list())
  }

  useEffect(() => {
    load()
  }, [])

  async function toggle(r) {
    await reviewsApi.setApproved(r.id, !r.is_approved)
    showToast(r.is_approved ? 'Rəy gizlədildi' : 'Rəy dərc olundu')
    load()
  }

  async function remove(r) {
    if (!confirm('Bu rəyi silmək istədiyinizə əminsiniz?')) return
    await reviewsApi.remove(r.id)
    load()
  }

  const shown = reviews.filter((r) => (filter === 'pending' ? !r.is_approved : filter === 'approved' ? r.is_approved : true))
  const pending = reviews.filter((r) => !r.is_approved).length

  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-[24px] font-semibold mb-4">Rəylər</h1>
      <div className="flex gap-1.5 mb-5">
        {[['pending', `Gözləyən (${pending})`], ['approved', 'Dərc olunmuş'], ['all', 'Hamısı']].map(([v, l]) => (
          <button key={v} onClick={() => setFilter(v)} className={`px-3.5 py-1.5 rounded-full text-[12px] font-semibold border ${filter === v ? 'bg-ink text-cream border-ink' : 'bg-panel text-muted border-border'}`}>
            {l}
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-3">
        {shown.length === 0 && <p className="text-muted text-[13.5px]">Rəy yoxdur</p>}
        {shown.map((r) => (
          <div key={r.id} className="bg-panel rounded-2xl border border-border/60 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="font-semibold text-[14px]">{r.customer_name} <span className="text-muted font-normal text-[12px]">· sifariş #{r.order_id}</span></p>
              <Stars n={r.rating} />
            </div>
            {r.comment && <p className="text-[13.5px] text-ink/80 mt-1.5">{r.comment}</p>}
            <div className="flex items-center justify-between mt-3 text-[12.5px] font-semibold">
              <span className="text-muted font-normal text-[11.5px]">{new Date(r.created_at).toLocaleString('az-AZ')}</span>
              <div className="flex gap-3">
                <button onClick={() => toggle(r)} className={r.is_approved ? 'text-muted' : 'text-success'}>{r.is_approved ? 'Gizlət' : 'Dərc et'}</button>
                <button onClick={() => remove(r)} className="text-danger">Sil</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default ReviewsAdmin
