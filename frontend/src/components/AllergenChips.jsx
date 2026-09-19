import { useMenuStore } from '../store/menuStore'
import { useLocalize } from '../lib/i18n'

// Məhsulun allergen ID-lərini kataloqdan ikon + tərcümə olunmuş adla göstərir. iconOnly — kart üçün yığcam rejim.
function AllergenChips({ ids = [], iconOnly = false, className = '' }) {
  const allergens = useMenuStore((s) => s.allergens)
  const localize = useLocalize()
  const items = allergens.filter((a) => ids.includes(a.id))
  if (items.length === 0) return null

  return (
    <div className={`flex flex-wrap gap-1 ${className}`} data-testid="allergen-chips">
      {items.map((a) =>
        iconOnly ? (
          <span key={a.id} title={localize(a, 'name')} className="text-[13px] leading-none" aria-label={localize(a, 'name')}>{a.icon}</span>
        ) : (
          <span key={a.id} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[12px] font-semibold bg-burgundy/10 text-burgundy">
            <span aria-hidden="true">{a.icon}</span>
            {localize(a, 'name')}
          </span>
        ),
      )}
    </div>
  )
}

export default AllergenChips
