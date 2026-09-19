import { pageWindow } from '../lib/usePagination'

const SIZES = [10, 20, 50]

// Nömrəli səhifələmə paneli: "1–10 / 56", ‹ 1 2 … 6 ›, səhifədə neçə element
function Pagination({ pagination, label = 'element' }) {
  const { page, pageCount, pageSize, setPageSize, goTo, total, from, to } = pagination
  if (total === 0) return null
  const btn = 'min-w-9 h-9 px-2 rounded-lg border text-[13px] font-semibold flex items-center justify-center transition-colors'

  return (
    <nav aria-label="Səhifələmə" className="mt-4 flex flex-wrap items-center justify-between gap-3" data-testid="pagination">
      <p className="text-[12.5px] text-muted" data-testid="pagination-summary">
        {from}–{to} / {total} {label}
      </p>
      <div className="flex items-center gap-1.5">
        {pageCount > 1 && (
          <>
            <button type="button" aria-label="Əvvəlki səhifə" disabled={page === 1} onClick={() => goTo(page - 1)} className={`${btn} border-border bg-panel hover:bg-blush disabled:opacity-40 disabled:hover:bg-panel`}>‹</button>
            {pageWindow(page, pageCount).map((p, i) =>
              p === '…' ? (
                <span key={`gap-${i}`} className="w-6 text-center text-muted" aria-hidden="true">…</span>
              ) : (
                <button
                  key={p}
                  type="button"
                  onClick={() => goTo(p)}
                  aria-label={`Səhifə ${p}`}
                  aria-current={p === page ? 'page' : undefined}
                  className={`${btn} ${p === page ? 'bg-burgundy text-white border-burgundy' : 'border-border bg-panel hover:bg-blush'}`}
                >
                  {p}
                </button>
              ),
            )}
            <button type="button" aria-label="Növbəti səhifə" disabled={page === pageCount} onClick={() => goTo(page + 1)} className={`${btn} border-border bg-panel hover:bg-blush disabled:opacity-40 disabled:hover:bg-panel`}>›</button>
          </>
        )}
        <label className="ml-2 flex items-center gap-1.5 text-[12px] text-muted">
          Səhifədə
          <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} aria-label="Səhifədə neçə element" className="bg-cream border border-border rounded-lg px-2 py-1.5 text-[12.5px]">
            {SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
      </div>
    </nav>
  )
}

export default Pagination
