import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMenuStore } from '../store/menuStore'
import { useCartStore } from '../store/cartStore'
import { useUiStore } from '../store/uiStore'
import { resolveUploadUrl } from '../lib/api'
import { useT, useLocalize } from '../lib/i18n'
import Badge from '../components/Badge'
import FavoriteButton from '../components/FavoriteButton'

function splitList(text) {
  if (!text) return []
  return text.split(/[,•\n]/).map((s) => s.trim()).filter(Boolean)
}

function ProductDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const products = useMenuStore((s) => s.products)
  const product = useMemo(() => products.find((p) => String(p.id) === id), [products, id])
  const addItem = useCartStore((s) => s.addItem)
  const showToast = useUiStore((s) => s.showToast)
  const t = useT()
  const localize = useLocalize()
  const [quantity, setQuantity] = useState(1)
  const [pulse, setPulse] = useState(false)

  useEffect(() => {
    setQuantity(1)
  }, [id])

  if (!product) {
    return (
      <div className="px-5 pt-20 text-center">
        <p className="text-muted">...</p>
      </div>
    )
  }

  const name = localize(product, 'name')
  const description = localize(product, 'description')
  const ingredients = splitList(localize(product, 'ingredients'))
  const allergens = splitList(localize(product, 'allergens'))

  function handleAdd() {
    addItem({ ...product, name }, quantity)
    setPulse(true)
    setTimeout(() => setPulse(false), 350)
    showToast(`${name} ${t('added_to_cart')}`)
  }

  return (
    <div className="pb-28">
      <div className="relative">
        <img
          src={resolveUploadUrl(product.image_url)}
          alt={name}
          className="w-full h-80 object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink/70 via-transparent to-transparent" />
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="absolute top-5 left-5 w-10 h-10 rounded-full bg-panel/90 backdrop-blur flex items-center justify-center shadow-md"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <FavoriteButton productId={product.id} className="absolute top-5 right-5 !w-10 !h-10 bg-panel/90 backdrop-blur shadow-md text-ink" />
        {product.is_popular && (
          <span className="absolute bottom-4 left-5">
            <Badge variant="popular">{t('popular')}</Badge>
          </span>
        )}
      </div>

      <div className="bg-panel -mt-6 rounded-t-[28px] relative px-6 pt-6 pb-8 shadow-[0_-10px_30px_-20px_rgba(32,26,22,0.5)]">
        <div className="flex items-start justify-between gap-4 mb-2">
          <h1 className="font-display text-[24px] font-semibold text-ink">{name}</h1>
          <span className="font-display text-[22px] font-bold text-burgundy whitespace-nowrap">
            {Number(product.price).toFixed(2)} ₼
          </span>
        </div>
        {product.prep_time_minutes && (
          <p className="text-[12.5px] text-muted mb-3">~{product.prep_time_minutes} {t('prep_time')}</p>
        )}
        {description && <p className="text-[14px] text-ink/80 leading-relaxed mb-5">{description}</p>}

        {ingredients.length > 0 && (
          <div className="mb-4 pt-4 border-t border-border">
            <h2 className="text-[12px] uppercase tracking-wider font-bold text-muted mb-2">{t('ingredients')}</h2>
            <p className="text-[13.5px] text-ink/80 leading-relaxed">{ingredients.join(', ')}</p>
          </div>
        )}

        {allergens.length > 0 && (
          <div className="mb-2 pt-4 border-t border-border">
            <h2 className="text-[12px] uppercase tracking-wider font-bold text-muted mb-2">{t('allergens')}</h2>
            <div className="flex flex-wrap gap-1.5">
              {allergens.map((a) => (
                <Badge key={a} variant="info">{a}</Badge>
              ))}
            </div>
          </div>
        )}
      </div>

      {product.is_available ? (
        <div className="fixed bottom-0 left-0 right-0 bg-panel border-t border-border px-5 py-4 flex items-center gap-4 shadow-[0_-8px_24px_-16px_rgba(32,26,22,0.4)] max-w-lg mx-auto">
          <div className="flex items-center gap-3 bg-cream rounded-full px-1 py-1 border border-border">
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="w-9 h-9 rounded-full flex items-center justify-center text-ink font-semibold hover:bg-blush"
            >
              −
            </button>
            <span className="w-5 text-center font-semibold">{quantity}</span>
            <button
              type="button"
              onClick={() => setQuantity((q) => q + 1)}
              className="w-9 h-9 rounded-full flex items-center justify-center text-ink font-semibold hover:bg-blush"
            >
              +
            </button>
          </div>
          <button
            type="button"
            onClick={handleAdd}
            className={`flex-1 bg-btn text-cream rounded-full py-3.5 font-semibold text-[14.5px] transition-transform ${pulse ? 'animate-pulse-once' : ''}`}
          >
            {t('add_to_order')} — {(Number(product.price) * quantity).toFixed(2)} ₼
          </button>
        </div>
      ) : (
        <div className="fixed bottom-0 left-0 right-0 bg-panel border-t border-border px-5 py-4 text-center max-w-lg mx-auto">
          <span className="text-[14px] text-muted font-semibold">{t('unavailable')}</span>
        </div>
      )}
    </div>
  )
}

export default ProductDetail
