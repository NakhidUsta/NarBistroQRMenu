import { useCallback, useEffect, useRef, useState } from 'react'

// Sonsuz sürüşdürmə: sentinel elementi görünəndə onVisible çağırılır (IntersectionObserver).
// Brauzer dəstəkləmirsə (köhnə brauzer/test mühiti) heç nə etmir — "Daha çox" düyməsi həmişə ehtiyat kimi var.
export function useSentinel(onVisible, { enabled = true } = {}) {
  const ref = useRef(null)
  const cb = useRef(onVisible)
  cb.current = onVisible

  useEffect(() => {
    if (!enabled || typeof IntersectionObserver === 'undefined') return undefined
    const el = ref.current
    if (!el) return undefined
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) cb.current()
      },
      { rootMargin: '300px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [enabled])

  return ref
}

// Müştəri tərəfdə mövcud siyahının tədricən göstərilməsi (yüklənmiş, lakin uzun siyahı — ilk render yüngül olsun).
// resetKey dəyişəndə (kateqoriya/axtarış) yenidən ilk səhifədən başlayır.
export function useVisibleCount(total, pageSize, resetKey) {
  const [count, setCount] = useState(pageSize)

  useEffect(() => {
    setCount(pageSize)
  }, [resetKey, pageSize])

  const more = useCallback(() => setCount((c) => Math.min(c + pageSize, total)), [pageSize, total])
  const hasMore = count < total
  const sentinelRef = useSentinel(more, { enabled: hasMore })
  return { count, hasMore, more, sentinelRef }
}
