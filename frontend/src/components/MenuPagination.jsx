import { useT } from '../lib/i18n'
import { pageWindow } from '../lib/usePagination'

// Müştəri menyusunun altında nömrəli səhifələmə: ‹ 1 2 3 › və "1–12 / 56"
function MenuPagination({ pagination }) {
  const t = useT()
  const { page, pageCount, goTo, total, from, to } = pagination
  if (pageCount <= 1) return null
  const btn = 'min-w-10 h-10 px-2.5 rounded-full border text-[14px] font-semibold flex items-center justify-center transition-colors'

  return (
    <nav aria-label={t('pagination_nav')} className="px-5 md:px-8 pt-2 pb-6 flex flex-col items-center gap-2.5" data-testid="menu-pagination">
      <div className="flex items-center gap-1.5 flex-wrap justify-center">
        <button type="button" aria-label={t('page_prev')} disabled={page === 1} onClick={() => goTo(page - 1)} className={`${btn} border-border bg-panel text-ink hover:bg-blush disabled:opacity-40 disabled:hover:bg-panel`}>‹</button>
        {pageWindow(page, pageCount).map((p, i) =>
          p === '…' ? (
            <span key={`gap-${i}`} className="w-6 text-center text-muted" aria-hidden="true">…</span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => goTo(p)}
              aria-label={`${t('page_word')} ${p}`}
              aria-current={p === page ? 'page' : undefined}
              className={`${btn} ${p === page ? 'bg-burgundy text-white border-burgundy' : 'border-border bg-panel text-ink hover:bg-blush'}`}
            >
              {p}
            </button>
          ),
        )}
        <button type="button" aria-label={t('page_next')} disabled={page === pageCount} onClick={() => goTo(page + 1)} className={`${btn} border-border bg-panel text-ink hover:bg-blush disabled:opacity-40 disabled:hover:bg-panel`}>›</button>
      </div>
      <p className="text-[12px] text-muted" data-testid="menu-pagination-summary">{from}–{to} / {total}</p>
    </nav>
  )
}

export default MenuPagination
