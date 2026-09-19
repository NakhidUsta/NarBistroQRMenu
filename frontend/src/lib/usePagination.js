import { useEffect, useMemo, useState } from 'react'

// Yaddaşdakı siyahı üçün səhifələmə (admin siyahıları). `resetKey` dəyişəndə (axtarış/filtr) 1-ci səhifəyə qayıdır;
// element silinib səhifə sayı azalsa cari səhifə avtomatik son səhifəyə çəkilir.
export function usePagination(items, { pageSize: initialSize = 10, resetKey, scroll = true } = {}) {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(initialSize)
  const total = items.length
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const current = Math.min(page, pageCount)

  useEffect(() => {
    setPage(1)
  }, [resetKey, pageSize])

  const slice = useMemo(() => items.slice((current - 1) * pageSize, current * pageSize), [items, current, pageSize])
  const from = total === 0 ? 0 : (current - 1) * pageSize + 1
  const to = Math.min(total, current * pageSize)

  function goTo(next) {
    setPage(Math.min(Math.max(1, next), pageCount))
    if (scroll && typeof window !== 'undefined') window.scrollTo?.({ top: 0, behavior: 'smooth' })
  }

  return { page: current, pageCount, pageSize, setPageSize, goTo, slice, total, from, to }
}

// 1 … 4 [5] 6 … 12 kimi səhifə nömrələri (ellipsis "…" sətir kimi qaytarılır)
export function pageWindow(page, pageCount) {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i + 1)
  const pages = new Set([1, pageCount, page - 1, page, page + 1])
  if (page <= 3) [2, 3, 4].forEach((p) => pages.add(p))
  if (page >= pageCount - 2) [pageCount - 3, pageCount - 2, pageCount - 1].forEach((p) => pages.add(p))
  const sorted = [...pages].filter((p) => p >= 1 && p <= pageCount).sort((a, b) => a - b)
  const out = []
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push('…')
    out.push(p)
  })
  return out
}
