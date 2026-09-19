import { useMenuStore } from '../store/menuStore'
import { useFavoritesStore } from '../store/favoritesStore'
import { useT } from '../lib/i18n'
import ProductCard from '../components/ProductCard'
import Button from '../components/Button'

function Favorites() {
  const t = useT()
  const products = useMenuStore((s) => s.products)
  const ids = useFavoritesStore((s) => s.ids)
  const favorites = products.filter((p) => ids.includes(p.id))

  return (
    <div className="px-5 md:px-8 pt-6 pb-28 md:pb-16">
      <h1 className="font-display text-[24px] font-semibold mb-5">{t('favorites_title')}</h1>
      {favorites.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-[13.5px] text-muted mb-5">{t('favorites_empty')}</p>
          <Button to="/menyu">{t('back_to_menu')}</Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3.5 md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-5">
          {favorites.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  )
}

export default Favorites
