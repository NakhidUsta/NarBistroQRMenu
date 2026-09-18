import { useEffect, useMemo, useRef, useState } from 'react'
import { adminApi } from '../lib/api'
import { adminSocket } from '../lib/socket'

const STATUS_LABELS = {
  NEW: 'Yeni', CONFIRMED: 'Təsdiqləndi', PREPARING: 'Hazırlanır',
  READY: 'Hazırdır', DELIVERED: 'Çatdırıldı', COMPLETED: 'Tamamlandı', CANCELLED: 'Ləğv edildi',
}
const RANGES = [
  ['today', 'Bu gün'],
  ['week', 'Son 7 gün'],
  ['month', 'Bu ay'],
  ['custom', 'Xüsusi'],
]

const money = (n) => `${Number(n || 0).toFixed(2)} ₼`

function StatCard({ label, value, accent, small }) {
  return (
    <div className="bg-panel rounded-2xl p-5 border border-border/60">
      <p className="text-[11.5px] uppercase tracking-wider font-semibold text-muted mb-1.5">{label}</p>
      <p className={`font-display font-bold ${small ? 'text-[17px] leading-[34px]' : 'text-[26px]'} ${accent ? 'text-burgundy' : 'text-ink'}`}>{value}</p>
    </div>
  )
}

function Card({ title, children, className = '' }) {
  return (
    <div className={`bg-panel rounded-2xl p-5 border border-border/60 ${className}`}>
      <h2 className="font-semibold text-[14.5px] mb-4">{title}</h2>
      {children}
    </div>
  )
}

// Sütun qrafiki (SVG). data: [{ label, value }]
function BarChart({ data, height = 150, format = (v) => v }) {
  if (!data.length) return <p className="text-[13px] text-muted">Bu aralıqda məlumat yoxdur</p>
  const max = Math.max(...data.map((d) => d.value), 1)
  const barW = 100 / data.length
  return (
    <div>
      <svg viewBox={`0 0 100 ${height / 3}`} preserveAspectRatio="none" className="w-full" style={{ height }}>
        {data.map((d, i) => {
          const h = (d.value / max) * (height / 3 - 4)
          const w = Math.min(barW * 0.64, 8)
          return (
            <g key={d.label}>
              <rect x={i * barW + (barW - w) / 2} y={height / 3 - h} width={w} height={h} rx="0.8" fill="#5c1a2e" opacity={d.value ? 0.9 : 0.15}>
                <title>{`${d.label}: ${format(d.value)}`}</title>
              </rect>
            </g>
          )
        })}
      </svg>
      <div className="flex mt-1">
        {data.map((d, i) => (
          <span key={d.label} className="flex-1 text-center text-[10px] text-muted truncate">
            {data.length > 14 && i % 2 ? '' : d.label}
          </span>
        ))}
      </div>
    </div>
  )
}

function HBars({ rows, format = (v) => v }) {
  if (!rows.length) return <p className="text-[13px] text-muted">Bu aralıqda məlumat yoxdur</p>
  const max = Math.max(...rows.map((r) => r.value), 1)
  return (
    <div className="flex flex-col gap-2.5">
      {rows.map((r) => (
        <div key={r.label}>
          <div className="flex justify-between text-[12.5px] mb-1">
            <span className="truncate pr-2">{r.label}</span>
            <span className="font-semibold shrink-0">{format(r.value)}</span>
          </div>
          <div className="h-1.5 bg-blush rounded-full overflow-hidden">
            <div className="h-full bg-burgundy rounded-full" style={{ width: `${(r.value / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}

function Dashboard() {
  const [range, setRange] = useState('today')
  const [custom, setCustom] = useState({ from: '', to: '' })
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const timer = useRef(null)

  const params = useMemo(() => (range === 'custom' ? { range, ...custom } : { range }), [range, custom])
  const ready = range !== 'custom' || (custom.from && custom.to && custom.from <= custom.to)

  async function load() {
    if (!ready) return
    try {
      setData(await adminApi.dashboard(params))
      setError('')
    } catch (err) {
      setError(err.response?.data?.error || 'Məlumat yüklənmədi')
    }
  }

  useEffect(() => {
    load()
  }, [params])

  // Canlı yenilənmə: sifariş/status dəyişəndə (qısa gecikmə ilə birləşdirilir) yenidən yüklə.
  useEffect(() => {
    const refresh = () => {
      clearTimeout(timer.current)
      timer.current = setTimeout(load, 600)
    }
    adminSocket.on('order-created', refresh)
    adminSocket.on('order-status-updated', refresh)
    return () => {
      adminSocket.off('order-created', refresh)
      adminSocket.off('order-status-updated', refresh)
      clearTimeout(timer.current)
    }
  }, [params])

  const daily = useMemo(
    () => (data?.daily_sales || []).map((d) => ({ label: d.day.slice(5), value: Number(d.sales) })),
    [data],
  )
  const hourly = useMemo(() => {
    const map = new Map((data?.hourly_orders || []).map((h) => [h.hour, h.orders]))
    return Array.from({ length: 24 }, (_, h) => ({ label: String(h), value: map.get(h) || 0 }))
  }, [data])

  const s = data?.summary

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="font-display text-[24px] font-semibold">Dashboard</h1>
        <div className="flex flex-wrap items-center gap-2">
          {range === 'custom' && (
            <>
              <input type="date" value={custom.from} onChange={(e) => setCustom({ ...custom, from: e.target.value })} className="bg-panel border border-border rounded-lg px-2.5 py-1.5 text-[12.5px]" />
              <span className="text-muted">–</span>
              <input type="date" value={custom.to} onChange={(e) => setCustom({ ...custom, to: e.target.value })} className="bg-panel border border-border rounded-lg px-2.5 py-1.5 text-[12.5px]" />
            </>
          )}
          <div className="flex bg-panel border border-border rounded-full p-0.5">
            {RANGES.map(([v, l]) => (
              <button key={v} onClick={() => setRange(v)} className={`px-3.5 py-1.5 rounded-full text-[12px] font-semibold ${range === v ? 'bg-ink text-cream' : 'text-muted'}`}>
                {l}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && <p className="text-danger text-[13px] mb-4">{error}</p>}
      {!data && !error && <p className="text-muted">Yüklənir...</p>}

      {data && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <StatCard label="Ümumi satış" value={money(s.total_sales)} accent />
            <StatCard label="Sifariş sayı" value={s.order_count} />
            <StatCard label="Orta çek" value={money(s.avg_check)} />
            <StatCard label="Ləğv edilmiş" value={s.cancelled_count} />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard label="Aktiv masalar" value={data.active_tables} />
            <StatCard label="Endirimlər" value={money(s.total_discount)} />
            <StatCard small label="Aralıq" value={data.range.from === data.range.to ? data.range.from : `${data.range.from.slice(5)} → ${data.range.to.slice(5)}`} />
            <StatCard label="Az qalan stok" value={data.low_stock.length} />
          </div>

          <div className="grid lg:grid-cols-2 gap-4 mb-4">
            <Card title="Günlük satış (₼)"><BarChart data={daily} format={money} /></Card>
            <Card title="Saata görə sifarişlər"><BarChart data={hourly} /></Card>
          </div>

          <div className="grid lg:grid-cols-3 gap-4 mb-4">
            <Card title="Ən çox satılan">
              <HBars rows={data.top_products.map((p) => ({ label: p.name, value: p.total_quantity }))} format={(v) => `${v}×`} />
            </Card>
            <Card title="Ən az satılan">
              <HBars rows={data.least_products.map((p) => ({ label: p.name, value: p.total_quantity }))} format={(v) => `${v}×`} />
            </Card>
            <Card title="Kateqoriya üzrə satış">
              <HBars rows={data.category_sales.map((c) => ({ label: c.name, value: Number(c.revenue) }))} format={money} />
            </Card>
          </div>

          <div className="grid lg:grid-cols-3 gap-4">
            <Card title="Status bölgüsü">
              {data.status_breakdown.length === 0 && <p className="text-[13px] text-muted">Sifariş yoxdur</p>}
              {data.status_breakdown.map((st) => (
                <div key={st.status} className="flex justify-between text-[13px] py-1">
                  <span>{STATUS_LABELS[st.status] || st.status}</span>
                  <span className="font-semibold">{st.count}</span>
                </div>
              ))}
            </Card>
            <Card title="Promo kodlar">
              {data.promo_usage.length === 0 && <p className="text-[13px] text-muted">İstifadə olunmayıb</p>}
              {data.promo_usage.map((p) => (
                <div key={p.code} className="flex justify-between text-[13px] py-1">
                  <span className="font-semibold text-burgundy">{p.code}</span>
                  <span>{p.uses}× · −{money(p.discount)}</span>
                </div>
              ))}
            </Card>
            <Card title="Son sifarişlər">
              {data.recent_orders.map((o) => (
                <div key={o.id} className="flex justify-between text-[12.5px] py-1">
                  <span>#{o.id} · {o.table_label || 'Masasız'}</span>
                  <span className="font-semibold">{money(o.total)} · {STATUS_LABELS[o.status]}</span>
                </div>
              ))}
            </Card>
          </div>

          {data.low_stock.length > 0 && (
            <Card title="⚠️ Az qalan stok" className="mt-4">
              {data.low_stock.map((p) => (
                <div key={p.id} className="flex justify-between text-[13px] py-1">
                  <span>{p.name}</span>
                  <span className="font-semibold text-danger">{p.stock_quantity} ədəd</span>
                </div>
              ))}
            </Card>
          )}
        </>
      )}
    </div>
  )
}

export default Dashboard
