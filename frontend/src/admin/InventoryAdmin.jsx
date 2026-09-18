import { useEffect, useState } from 'react'
import { insightsApi, productsApi } from '../lib/api'
import { useUiStore } from '../store/uiStore'

const REASONS = { order: 'Sifariş', restock: 'Doldurma', manual_adjustment: 'Əl ilə düzəliş' }
const LOW = 5

function InventoryAdmin() {
  const showToast = useUiStore((s) => s.showToast)
  const [data, setData] = useState(null)

  async function load() {
    setData(await insightsApi.inventory())
  }

  useEffect(() => {
    load()
  }, [])

  async function adjust(p, delta) {
    try {
      await productsApi.adjustStock(p.id, delta)
      load()
    } catch (err) {
      showToast(err.response?.data?.error || 'Xəta baş verdi', 'error')
    }
  }

  if (!data) return <p className="text-muted">Yüklənir...</p>

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div>
        <h1 className="font-display text-[24px] font-semibold mb-1">Stok</h1>
        <p className="text-[12.5px] text-muted mb-4">Yalnız "Stok izlənsin" işarələnmiş məhsullar. Sıfıra düşəndə məhsul avtomatik "Bitib" olur.</p>
        <div className="bg-panel rounded-2xl border border-border/60 overflow-hidden">
          {data.products.length === 0 && <p className="p-5 text-muted text-[13px]">Stok izlənən məhsul yoxdur (Menyu → məhsulu redaktə et → "Stok izlənsin")</p>}
          {data.products.map((p) => {
            const qty = p.stock_quantity ?? 0
            return (
              <div key={p.id} className="flex items-center gap-3 px-5 py-3 border-b border-border/60 last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[13.5px] truncate">{p.name}</p>
                  <p className="text-[11.5px] text-muted">{p.category || '—'}{!p.is_available && ' · Bitib'}</p>
                </div>
                <span className={`text-[12px] font-bold rounded-full px-2.5 py-1 ${qty <= 0 ? 'bg-danger/15 text-danger' : qty <= LOW ? 'bg-gold/25 text-ink' : 'bg-success/15 text-success'}`}>
                  {qty} ədəd
                </span>
                <div className="flex gap-1">
                  {[-10, -1, 1, 10].map((d) => (
                    <button key={d} onClick={() => adjust(p, d)} disabled={qty + d < 0} className="w-9 h-7 rounded-lg border border-border bg-cream text-[11.5px] font-semibold disabled:opacity-30">
                      {d > 0 ? `+${d}` : d}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div>
        <h2 className="font-display text-[20px] font-semibold mb-4 lg:mt-[52px]">Son hərəkətlər</h2>
        <div className="bg-panel rounded-2xl border border-border/60 overflow-hidden">
          {data.movements.length === 0 && <p className="p-5 text-muted text-[13px]">Hələ hərəkət yoxdur</p>}
          {data.movements.map((m) => (
            <div key={m.id} className="flex items-center justify-between px-5 py-2.5 border-b border-border/60 last:border-0 text-[12.5px]">
              <div className="min-w-0">
                <p className="font-semibold truncate">{m.product_name || `#${m.product_id}`}</p>
                <p className="text-[11px] text-muted">{REASONS[m.reason] || m.reason}{m.order_id ? ` · sifariş #${m.order_id}` : ''} · {new Date(m.created_at).toLocaleString('az-AZ')}</p>
              </div>
              <span className={`font-bold ${m.change_qty > 0 ? 'text-success' : 'text-danger'}`}>{m.change_qty > 0 ? `+${m.change_qty}` : m.change_qty}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default InventoryAdmin
