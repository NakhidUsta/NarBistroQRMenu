import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useMenuStore } from '../store/menuStore'
import { useTableSessionStore } from '../store/tableSessionStore'
import { useUiStore } from '../store/uiStore'
import { useT, useLocalize } from '../lib/i18n'
import CategoryTabs from '../components/CategoryTabs'
import ProductCard from '../components/ProductCard'

function Menu() {
  const [searchParams] = useSearchParams()
  const categories = useMenuStore((s) => s.categories)
  const products = useMenuStore((s) => s.products)
  const status = useMenuStore((s) => s.status)
  const scanTable = useTableSessionStore((s) => s.scan)
  const showToast = useUiStore((s) => s.showToast)
  const t = useT()
  const localize = useLocalize()
  const [activeCategory, setActiveCategory] = useState('all')
  const [query, setQuery] = useState('')

  const tabs = useMemo(
    () => [{ id: 'all', name: t('all') }, ...categories.map((c) => ({ ...c, name: localize(c, 'name') }))],
    [categories, t, localize],
  )

  useEffect(() => {
    const code = searchParams.get('table')
    const token = searchParams.get('t')
    if (code && token) {
      scanTable(code, token).catch(() => showToast('QR kod etibarsızdır', 'error'))
    }
  }, [])

  const filtered = useMemo(() => {
    let list = products
    if (query.trim()) {
      const q = query.trim().toLowerCase()
      list = list.filter((p) => localize(p, 'name').toLowerCase().includes(q) || localize(p, 'description').toLowerCase().includes(q))
    } else if (activeCategory !== 'all') {
      list = list.filter((p) => p.category_id === activeCategory)
    }
    return list
  }, [products, activeCategory, query, localize])

  return (
    <div className="pb-28">
      <div className="px-5 mb-4">
        <div className="relative">
          <svg className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" strokeLinecap="round" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('search_placeholder')}
            className="w-full bg-panel border border-border rounded-full pl-11 pr-4 py-3 text-[14px] text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-burgundy/30"
          />
        </div>
      </div>

      {!query.trim() && (
        <div className="mb-5">
          <CategoryTabs categories={tabs} activeId={activeCategory} onSelect={setActiveCategory} />
          <div className="h-px bg-border mx-5" />
        </div>
      )}

      <div className="px-5 flex flex-col gap-3.5">
        {status === 'loading' && (
          <>
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-4 bg-panel rounded-2xl p-3 border border-border/60 animate-pulse">
                <div className="w-24 h-24 rounded-xl bg-blush" />
                <div className="flex-1 space-y-2 py-2">
                  <div className="h-4 bg-blush rounded w-2/3" />
                  <div className="h-3 bg-blush rounded w-full" />
                  <div className="h-3 bg-blush rounded w-1/3" />
                </div>
              </div>
            ))}
          </>
        )}
        {status === 'ready' && filtered.length === 0 && (
          <div className="text-center py-16">
            <p className="font-display text-lg text-ink mb-1">{t('not_found_title')}</p>
            <p className="text-[13px] text-muted">{t('not_found_body')}</p>
          </div>
        )}
        {filtered.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </div>
  )
}

export default Menu
