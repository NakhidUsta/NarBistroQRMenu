import { useState } from 'react'
import { insightsApi } from '../lib/api'
import { useUiStore } from '../store/uiStore'
import Button from '../components/Button'

const iso = (d) => d.toISOString().slice(0, 10)

function ReportsAdmin() {
  const showToast = useUiStore((s) => s.showToast)
  const today = new Date()
  const [from, setFrom] = useState(`${iso(today).slice(0, 8)}01`)
  const [to, setTo] = useState(iso(today))
  const [busy, setBusy] = useState('')

  async function download(kind) {
    setBusy(kind)
    try {
      await insightsApi.downloadCsv(kind, from, to)
    } catch (err) {
      showToast(err.response?.status === 400 ? 'Tarix aralığı düzgün deyil' : 'Hesabat yüklənmədi', 'error')
    } finally {
      setBusy('')
    }
  }

  return (
    <div className="max-w-xl">
      <h1 className="font-display text-[24px] font-semibold mb-1">Hesabatlar</h1>
      <p className="text-[12.5px] text-muted mb-5">CSV faylları Excel-də açılır. Tarixlər restoranın yerli vaxtı ilədir.</p>

      <div className="bg-panel rounded-2xl border border-border/60 p-5 flex flex-col gap-4">
        <div className="flex items-end gap-3 flex-wrap">
          <div>
            <label className="text-[11.5px] font-semibold text-muted mb-1 block">Başlanğıc</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="bg-cream border border-border rounded-lg px-3 py-2 text-[13px]" />
          </div>
          <div>
            <label className="text-[11.5px] font-semibold text-muted mb-1 block">Son</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="bg-cream border border-border rounded-lg px-3 py-2 text-[13px]" />
          </div>
        </div>
        <div className="flex gap-3 flex-wrap">
          <Button onClick={() => download('orders')} disabled={!!busy}>{busy === 'orders' ? 'Hazırlanır...' : '⬇ Sifarişlər (CSV)'}</Button>
          <Button variant="outline" onClick={() => download('products')} disabled={!!busy}>{busy === 'products' ? 'Hazırlanır...' : '⬇ Məhsul satışı (CSV)'}</Button>
        </div>
      </div>
    </div>
  )
}

export default ReportsAdmin
