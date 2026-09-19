import { useCallback, useEffect, useState } from 'react'
import { auditApi } from '../lib/api'
import { useSentinel } from '../lib/useInfinite'
import LoadMore from '../components/LoadMore'

const PAGE_SIZE = 50

const ENTITY_FILTERS = [
  ['', 'Hamısı'],
  ['products', 'Məhsullar'],
  ['categories', 'Kateqoriyalar'],
  ['orders', 'Sifarişlər'],
  ['restaurant_tables', 'Masalar'],
  ['promo_codes', 'Promo kodlar'],
  ['restaurants', 'Restoran'],
  ['admin_users', 'İşçilər'],
]

function parse(json) {
  try {
    return json ? JSON.parse(json) : null
  } catch {
    return null
  }
}

// Yalnız dəyişən sahələri "köhnə → yeni" formasında göstərir (məs. price: 15 → 17).
function diffLines(before, after) {
  const b = parse(before) || {}
  const a = parse(after) || {}
  const keys = [...new Set([...Object.keys(b), ...Object.keys(a)])].filter((k) => !['created_at'].includes(k))
  const changed = keys.filter((k) => JSON.stringify(b[k]) !== JSON.stringify(a[k]))
  if (!before && after) return [`yeni: ${JSON.stringify(a).slice(0, 140)}`]
  if (before && !after) return ['silindi']
  return changed.slice(0, 6).map((k) => `${k}: ${JSON.stringify(b[k]) ?? '—'} → ${JSON.stringify(a[k]) ?? '—'}`)
}

function AuditLogsAdmin() {
  const [logs, setLogs] = useState([])
  const [entity, setEntity] = useState('')
  const [loading, setLoading] = useState(true)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)

  useEffect(() => {
    setLoading(true)
    auditApi
      .listPage({ limit: PAGE_SIZE, ...(entity && { entity_type: entity }) })
      .then(({ items, hasMore: more }) => {
        setLogs(items)
        setHasMore(more)
      })
      .finally(() => setLoading(false))
  }, [entity])

  const loadMore = useCallback(async () => {
    if (loadingMore || !logs.length) return
    setLoadingMore(true)
    try {
      const { items, hasMore: more } = await auditApi.listPage({ limit: PAGE_SIZE, before: logs[logs.length - 1].id, ...(entity && { entity_type: entity }) })
      setLogs((prev) => [...prev, ...items.filter((i) => !prev.some((p) => p.id === i.id))])
      setHasMore(more)
    } finally {
      setLoadingMore(false)
    }
  }, [logs, entity, loadingMore])
  const sentinelRef = useSentinel(loadMore, { enabled: hasMore })

  return (
    <div>
      <h1 className="font-display text-[24px] font-semibold mb-4">Audit Log</h1>
      <div className="flex flex-wrap gap-1.5 mb-5">
        {ENTITY_FILTERS.map(([value, label]) => (
          <button
            key={value}
            onClick={() => setEntity(value)}
            className={`px-3 py-1.5 rounded-full text-[12px] font-semibold border ${
              entity === value ? 'bg-ink text-cream border-ink' : 'bg-panel text-muted border-border'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="bg-panel rounded-2xl border border-border/60 overflow-hidden">
        {loading && <p className="p-5 text-muted text-[13px]">Yüklənir...</p>}
        {!loading && logs.length === 0 && <p className="p-5 text-muted text-[13px]">Hələ qeyd yoxdur</p>}
        {logs.map((l) => {
          const d = new Date(l.created_at)
          return (
            <div key={l.id} className="px-5 py-3.5 border-b border-border/60 last:border-0">
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold text-[13.5px]">
                  {l.action} <span className="text-muted font-normal">· {l.entity_type} #{l.entity_id}</span>
                </p>
                <p className="text-[11.5px] text-muted shrink-0">
                  {d.toLocaleDateString('az-AZ')} {d.toLocaleTimeString('az-AZ', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              <p className="text-[12px] text-muted mt-0.5">{l.admin_email || 'sistem'}</p>
              {diffLines(l.before_json, l.after_json).map((line, i) => (
                <p key={i} className="text-[12px] font-mono text-ink/80 mt-0.5 break-all">{line}</p>
              ))}
            </div>
          )
        })}
        <LoadMore sentinelRef={sentinelRef} hasMore={hasMore} loading={loadingMore} onMore={loadMore} label="Daha köhnə qeydlər" />
      </div>
    </div>
  )
}

export default AuditLogsAdmin
