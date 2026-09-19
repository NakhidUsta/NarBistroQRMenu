import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useMenuStore } from '../store/menuStore'
import { useTableSessionStore } from '../store/tableSessionStore'
import { useUiStore } from '../store/uiStore'
import { useT, useLocalize } from '../lib/i18n'
import CategoryTabs from '../components/CategoryTabs'
import ProductCard from '../components/ProductCard'
import LoadMore from '../components/LoadMore'
import { useVisibleCount } from '../lib/useInfinite'
import { useAllergenFilterStore, hidesProduct } from '../store/allergenFilterStore'

const PAGE_SIZE = 12

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
  const [filterOpen, setFilterOpen] = useState(false)
  const allergens = useMenuStore((s) => s.allergens)
  const avoid = useAllergenFilterStore((s) => s.avoid)
  const toggleAvoid = useAllergenFilterStore((s) => s.toggle)
  const clearAvoid = useAllergenFilterStore((s) => s.clear)

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

  const ingredientCatalog = useMenuStore((s) => s.ingredients)

  const filtered = useMemo(() => {
    let list = products
    if (query.trim()) {
      // toLocaleLowerCase('az'): "İçkilər" → "içkilər" (adi toLowerCase "i̇" + nöqtə əmələ gətirir və axtarış tapmır)
      const norm = (v) => String(v || '').toLocaleLowerCase('az')
      const q = norm(query.trim())
      // ad, təsvir, kateqoriya adı və tərkib komponentləri (kataloq + köhnə mətn) üzrə axtarış — cari dildə
      const categoryName = (p) => localize(categories.find((c) => c.id === p.category_id), 'name')
      const ingredientNames = (p) =>
        [...(p.ingredient_ids || []).map((id) => localize(ingredientCatalog.find((i) => i.id === id), 'name')), localize(p, 'ingredients')].join(' ')
      list = list.filter((p) => [localize(p, 'name'), localize(p, 'description'), categoryName(p), ingredientNames(p)].some((field) => norm(field).includes(q)))
    } else if (activeCategory !== 'all') {
      list = list.filter((p) => p.category_id === activeCategory)
    }
    return list
  }, [products, categories, ingredientCatalog, activeCategory, query, localize])

  const visible = useMemo(() => filtered.filter((p) => !hidesProduct(p, avoid)), [filtered, avoid])
  const hiddenCount = filtered.length - visible.length

  // Uzun siyahı tədricən göstərilir (sonsuz sürüşdürmə); kateqoriya/axtarış/filtr dəyişəndə yenidən başlayır
  const { count, hasMore, more, sentinelRef } = useVisibleCount(visible.length, PAGE_SIZE, `${activeCategory}|${query}|${avoid.join(',')}`)

  return (
    <div className="pb-2">
      <div className="px-5 md:px-8 mb-4">
        <div className="relative md:max-w-xl">
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

      {allergens.length > 0 && (
        <div className="px-5 md:px-8 mb-4">
          <button
            type="button"
            onClick={() => setFilterOpen((o) => !o)}
            aria-expanded={filterOpen}
            className={`text-[12.5px] font-semibold rounded-full px-3.5 py-1.5 border ${avoid.length ? 'bg-burgundy text-white border-burgundy' : 'bg-panel text-muted border-border'}`}
          >
            {t('allergen_filter')}{avoid.length > 0 && ` (${avoid.length})`}
          </button>
          {filterOpen && (
            <div className="mt-2.5 bg-panel border border-border/60 rounded-2xl p-3.5">
              <p className="text-[12px] text-muted mb-2.5">{t('allergen_filter_hint')}</p>
              <div className="flex flex-wrap gap-1.5">
                {allergens.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    aria-pressed={avoid.includes(a.id)}
                    onClick={() => toggleAvoid(a.id)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[12px] font-semibold border ${avoid.includes(a.id) ? 'bg-burgundy text-white border-burgundy' : 'bg-cream text-ink border-border'}`}
                  >
                    <span aria-hidden="true">{a.icon}</span>
                    {localize(a, 'name')}
                  </button>
                ))}
              </div>
              {avoid.length > 0 && (
                <button type="button" onClick={clearAvoid} className="mt-2.5 text-[12px] font-semibold text-burgundy underline">{t('allergen_filter_clear')}</button>
              )}
            </div>
          )}
          {hiddenCount > 0 && <p className="mt-2 text-[12px] text-muted">{hiddenCount} {t('allergen_hidden')}</p>}
        </div>
      )}

      {!query.trim() && (
        <div className="mb-5">
          <CategoryTabs categories={tabs} activeId={activeCategory} onSelect={setActiveCategory} />
          <div className="h-px bg-border mx-5 md:mx-8" />
        </div>
      )}

      <div className="px-5 md:px-8 flex flex-col gap-3.5 md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-5 pb-4">
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
        {status === 'error' && (
          <div className="text-center py-16 md:col-span-full">
            <p className="font-display text-lg text-ink mb-1">{t('load_error_title')}</p>
            <p className="text-[13px] text-muted mb-4">{t('load_error_body')}</p>
            <button
              type="button"
              onClick={() => useMenuStore.getState().fetchAll()}
              className="bg-btn text-cream rounded-full px-6 py-2.5 text-[13.5px] font-semibold"
            >
              {t('retry')}
            </button>
          </div>
        )}
        {status === 'ready' && visible.length === 0 && (
          <div className="text-center py-16 md:col-span-full">
            <p className="font-display text-lg text-ink mb-1">{t('not_found_title')}</p>
            <p className="text-[13px] text-muted">{t('not_found_body')}</p>
          </div>
        )}
        {visible.slice(0, count).map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
        <LoadMore sentinelRef={sentinelRef} hasMore={hasMore} onMore={more} label={t('load_more')} className="md:col-span-full" />
      </div>
    </div>
  )
}

export default Menu
