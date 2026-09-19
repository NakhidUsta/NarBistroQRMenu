// Siyahının sonunda: sentinel (sonsuz sürüşdürmə üçün) + əl ilə "Daha çox göstər" düyməsi (ehtiyat, əlçatanlıq).
function LoadMore({ sentinelRef, hasMore, loading = false, onMore, label = 'Daha çox göstər', className = '' }) {
  if (!hasMore) return null
  return (
    <div ref={sentinelRef} className={`flex justify-center py-4 ${className}`} data-testid="load-more">
      <button
        type="button"
        onClick={onMore}
        disabled={loading}
        className="text-[13px] font-semibold text-burgundy border border-border rounded-full px-5 py-2 hover:bg-blush disabled:opacity-60"
      >
        {loading ? '...' : label}
      </button>
    </div>
  )
}

export default LoadMore
