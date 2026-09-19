import { useEffect, useState } from 'react'
import { useT } from '../lib/i18n'

// Bir səhifədə neçə kateqoriya: telefon 8 (bir neçə sətirdə "həb" düymələri), planşet 4, kompüter 6 ("Hamısı" həmişə sabit qalır və sayılmır)
const tabsPerPage = () => (typeof window === 'undefined' ? 6 : window.innerWidth >= 1024 ? 6 : window.innerWidth >= 768 ? 4 : 8)

function useTabsPerPage() {
  const [size, setSize] = useState(tabsPerPage)
  useEffect(() => {
    const onResize = () => setSize(tabsPerPage())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return size
}

// Kateqoriya tab-ları səhifələnir: ‹ Hamısı  Salatlar  Şorbalar  Pizzalar ›  (1/5)
function CategoryTabs({ categories, activeId, onSelect }) {
  const t = useT()
  const perPage = useTabsPerPage()
  const pinned = categories.filter((c) => c.id === 'all')
  const rest = categories.filter((c) => c.id !== 'all')
  const pageCount = Math.max(1, Math.ceil(rest.length / perPage))
  const [page, setPage] = useState(1)
  const current = Math.min(page, pageCount)

  // Aktiv kateqoriya başqa səhifədədirsə (məs. axtarışdan sonra) həmin səhifəyə keçirik
  useEffect(() => {
    const index = rest.findIndex((c) => c.id === activeId)
    if (index >= 0) setPage(Math.floor(index / perPage) + 1)
  }, [activeId, perPage])

  const visible = [...pinned, ...rest.slice((current - 1) * perPage, current * perPage)]
  const arrow = 'w-8 h-8 rounded-full border border-border bg-panel text-ink text-[15px] font-semibold flex items-center justify-center shrink-0 md:-mt-1 hover:bg-blush disabled:opacity-35 disabled:hover:bg-panel'

  return (
    // Telefonda: yuxarıda ‹ 1/3 › sətri, altında kateqoriyalar bir neçə sətirdə həb (chip) düymələri kimi; kompüterdə hamısı bir sətirdə tab kimi
    <div className="flex flex-wrap md:flex-nowrap items-center md:items-start justify-center md:justify-start gap-2 md:gap-2 px-5 md:px-8">
      {pageCount > 1 && (
        <button type="button" aria-label={t('categories_prev')} disabled={current === 1} onClick={() => setPage(current - 1)} className={arrow}>‹</button>
      )}
      <div className="order-last basis-full mt-2 md:mt-0 md:order-none md:basis-auto flex flex-wrap md:flex-nowrap gap-2 pb-3 md:pb-1 md:gap-9 md:overflow-x-auto md:flex-1 min-w-0 no-scrollbar" style={{ scrollbarWidth: 'none' }}>
        {visible.map((cat) => {
          const isActive = cat.id === activeId
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => onSelect(cat.id)}
              className={`relative whitespace-nowrap text-[13.5px] md:text-[14.5px] font-semibold transition-colors rounded-full border px-3.5 py-1.5 md:rounded-none md:border-transparent md:bg-transparent md:px-0 md:py-0 md:pb-3 ${
                isActive ? 'bg-burgundy text-white border-burgundy md:text-burgundy' : 'bg-panel text-ink border-border md:text-muted md:hover:text-ink'
              }`}
            >
              {cat.name}
              <span
                className={`hidden md:block absolute left-0 right-0 -bottom-px h-[2.5px] rounded-full transition-all ${
                  isActive ? 'bg-gold scale-x-100' : 'scale-x-0'
                }`}
              />
            </button>
          )
        })}
      </div>
      {pageCount > 1 && (
        <>
          <span className="text-[12px] text-muted tabular-nums md:pt-1.5 shrink-0 min-w-10 text-center" data-testid="category-page" aria-live="polite">{current}/{pageCount}</span>
          <button type="button" aria-label={t('categories_next')} disabled={current === pageCount} onClick={() => setPage(current + 1)} className={arrow}>›</button>
        </>
      )}
    </div>
  )
}

export default CategoryTabs
