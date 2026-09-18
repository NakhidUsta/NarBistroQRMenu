import { useEffect, useState } from 'react'
import { insightsApi } from '../lib/api'

function CustomersAdmin() {
  const [q, setQ] = useState('')
  const [rows, setRows] = useState(null)

  useEffect(() => {
    const timer = setTimeout(() => insightsApi.customers(q.trim()).then(setRows), q ? 300 : 0)
    return () => clearTimeout(timer)
  }, [q])

  return (
    <div>
      <h1 className="font-display text-[24px] font-semibold mb-1">Müştərilər</h1>
      <p className="text-[12.5px] text-muted mb-4">Müştərilər telefon nömrəsi ilə eyniləşdirilir (sifariş tarixçəsindən).</p>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Ad və ya telefon üzrə axtar"
        className="w-full max-w-md mb-5 bg-panel border border-border rounded-full px-4 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-burgundy/30"
      />
      <div className="bg-panel rounded-2xl border border-border/60 overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-muted border-b border-border">
              <th className="px-5 py-3">Müştəri</th>
              <th className="px-3 py-3">Telefon</th>
              <th className="px-3 py-3 text-right">Sifariş</th>
              <th className="px-3 py-3 text-right">Xərclədi</th>
              <th className="px-5 py-3">Son sifariş</th>
            </tr>
          </thead>
          <tbody>
            {rows?.map((c) => (
              <tr key={c.phone} className="border-b border-border/60 last:border-0">
                <td className="px-5 py-3 font-semibold">{c.name}</td>
                <td className="px-3 py-3 text-muted">{c.phone}</td>
                <td className="px-3 py-3 text-right">{c.orders_count}</td>
                <td className="px-3 py-3 text-right font-semibold text-burgundy">{Number(c.total_spent).toFixed(2)} ₼</td>
                <td className="px-5 py-3 text-muted">{new Date(c.last_order_at).toLocaleDateString('az-AZ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows && rows.length === 0 && <p className="p-5 text-muted text-[13px]">Müştəri tapılmadı</p>}
        {!rows && <p className="p-5 text-muted text-[13px]">Yüklənir...</p>}
      </div>
    </div>
  )
}

export default CustomersAdmin
