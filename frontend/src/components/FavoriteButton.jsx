import { useFavoritesStore } from '../store/favoritesStore'
import { useT } from '../lib/i18n'

function FavoriteButton({ productId, className = '' }) {
  const active = useFavoritesStore((s) => s.ids.includes(productId))
  const toggle = useFavoritesStore((s) => s.toggle)
  const t = useT()

  return (
    <button
      type="button"
      aria-label={active ? t('favorite_remove') : t('favorite_add')}
      aria-pressed={active}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        toggle(productId)
      }}
      className={`w-8 h-8 rounded-full flex items-center justify-center transition-transform active:scale-90 ${className}`}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill={active ? '#5c1a2e' : 'none'} stroke={active ? '#5c1a2e' : 'currentColor'} strokeWidth="1.9" strokeLinejoin="round">
        <path d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2z" />
      </svg>
    </button>
  )
}

export default FavoriteButton
