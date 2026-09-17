import { useEffect, useState } from 'react'
import { adminApi } from '../lib/api'

const STATUS_LABELS = {
  NEW: 'Yeni', CONFIRMED: 'Təsdiqləndi', PREPARING: 'Hazırlanır',
  READY: 'Hazırdır', DELIVERED: 'Çatdırıldı', COMPLETED: 'Tamamlandı', CANCELLED: 'Ləğv edildi',
}

function StatCard({ label, value, accent }) {
  return (
    <div className="bg-panel rounded-2xl p-5 border border-border/60">
      <p className="text-[12px] uppercase tracking-wider font-semibold text-muted mb-1.5">{label}</p>
      <p className={`font-display text-[28px] font-bold ${accent ? 'text-burgundy' : 'text-ink'}`}>{value}</p>
    </div>
  )
}

function Dashboard() {
  const [data, setData] = useState(null)

  useEffect(() => {
    adminApi.dashboard().then(setData)
  }, [])

  if (!data) return <p className="text-muted">Yüklənir...</p>

  return (
    <div>
      <h1 className="font-display text-[24px] font-semibold mb-6">Dashboard</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="Bugünkü sifarişlər" value={data.today_order_count} />
        <StatCard label="Bugünkü satış" value={`${Number(data.today_sales).toFixed(2)} ₼`} accent />
        <StatCard label="Aktiv masalar" value={data.active_tables} />
        <StatCard label="Status sayı" value={data.status_breakdown.length} />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-panel rounded-2xl p-5 border border-border/60">
          <h2 className="font-semibold text-[15px] mb-4">Status bölgüsü (bugün)</h2>
          <div className="flex flex-col gap-2">
            {data.status_breakdown.length === 0 && <p className="text-[13px] text-muted">Bu gün hələ sifariş yoxdur</p>}
            {data.status_breakdown.map((s) => (
              <div key={s.status} className="flex justify-between text-[13.5px]">
                <span>{STATUS_LABELS[s.status] || s.status}</span>
                <span className="font-semibold">{s.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-panel rounded-2xl p-5 border border-border/60">
          <h2 className="font-semibold text-[15px] mb-4">Ən çox satılan (son 7 gün)</h2>
          <div className="flex flex-col gap-2">
            {data.top_products.length === 0 && <p className="text-[13px] text-muted">Hələ məlumat yoxdur</p>}
            {data.top_products.map((p) => (
              <div key={p.id} className="flex justify-between text-[13.5px]">
                <span>{p.name}</span>
                <span className="font-semibold">{p.total_quantity}×</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
