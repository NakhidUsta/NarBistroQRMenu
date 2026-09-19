import { Link } from 'react-router-dom'
import ResponsiveImage from './ResponsiveImage'
import { useT, useLocalize } from '../lib/i18n'
import Badge from './Badge'
import FavoriteButton from './FavoriteButton'
import AllergenChips from './AllergenChips'

function ProductCard({ product }) {
  const unavailable = !product.is_available
  const t = useT()
  const localize = useLocalize()
  const name = localize(product, 'name')
  const description = localize(product, 'description')

  return (
    <Link
      to={`/product/${product.id}`}
      className={`group flex gap-4 bg-panel rounded-2xl p-3 shadow-[0_10px_30px_-20px_rgba(32,26,22,0.4)] border border-border/60 transition-transform hover:-translate-y-0.5 ${
        unavailable ? 'opacity-60' : ''
      }`}
    >
      <div className="relative shrink-0 w-24 h-24 rounded-xl overflow-hidden bg-blush">
        <ResponsiveImage
          src={product.image_url}
          alt={name}
          thumb
          loading="lazy"
          className="w-full h-full object-cover"
        />
        {product.is_popular && (
          <span className="absolute top-1 left-1">
            <Badge variant="popular">{t('popular')}</Badge>
          </span>
        )}
      </div>
      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <div className="flex items-start justify-between gap-1">
          <h3 className="font-display text-[17px] font-semibold text-ink truncate">{name}</h3>
          <FavoriteButton productId={product.id} className="-mt-1 -mr-1 text-muted shrink-0" />
        </div>
        {description && (
          <p className="text-[12.5px] text-muted leading-snug line-clamp-2 mt-0.5">{description}</p>
        )}
        <AllergenChips ids={product.allergen_ids} iconOnly className="mt-1" />
        <div className="mt-1.5 flex items-center gap-2">
          <span className="font-display text-[15px] font-bold text-burgundy">{Number(product.price).toFixed(2)} ₼</span>
          {unavailable && <Badge variant="unavailable">{t('sold_out')}</Badge>}
        </div>
      </div>
    </Link>
  )
}

export default ProductCard
