import { useMemo, useState } from 'react'
import { ingredientsApi } from '../lib/api'
import { useMenuStore } from '../store/menuStore'
import { useUiStore } from '../store/uiStore'

const MAX = 40

// Məhsulun tərkibi: kataloqdan sıralı seçim. Kataloqda olmayan komponent yazıb "Əlavə et" ilə dərhal yaradıla bilər
// (EN/RU tərcümələri "Tərkiblər" səhifəsində doldurulur).
function IngredientPicker({ value = [], onChange }) {
  const catalog = useMenuStore((s) => s.ingredients)
  const upsertIngredient = useMenuStore((s) => s.upsertIngredient)
  const showToast = useUiStore((s) => s.showToast)
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)

  const byId = useMemo(() => new Map(catalog.map((i) => [i.id, i])), [catalog])
  const term = query.trim().toLowerCase()
  const exact = catalog.find((i) => i.name.toLowerCase() === term)
  const suggestions = term
    ? catalog.filter((i) => !value.includes(i.id) && i.name.toLowerCase().includes(term)).slice(0, 8)
    : []
  const full = value.length >= MAX

  function add(id) {
    if (!value.includes(id) && !full) onChange([...value, id])
    setQuery('')
  }

  async function createAndAdd() {
    if (exact) return add(exact.id)
    setBusy(true)
    try {
      const created = await ingredientsApi.create({ name: query.trim() })
      upsertIngredient(created, 'created')
      add(created.id)
    } catch (err) {
      showToast(err.response?.data?.error || 'Komponent əlavə edilmədi', 'error')
    } finally {
      setBusy(false)
    }
  }

  function move(index, delta) {
    const target = index + delta
    if (target < 0 || target >= value.length) return
    const next = [...value]
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
  }

  return (
    <div>
      <label className="text-[12.5px] font-semibold text-muted mb-1 block">Tərkibi (kataloqdan) <span className="font-normal">({value.length}/{MAX})</span></label>
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-1.5 mb-2" data-testid="ingredient-list">
          {value.map((id, i) => (
            <li key={id} className="inline-flex items-center gap-0.5 pl-2.5 pr-1 py-1 rounded-full bg-burgundy/10 text-burgundy text-[12px] font-semibold">
              {byId.get(id)?.name ?? `#${id}`}
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Əvvələ" className="w-5 h-5 text-[11px] disabled:opacity-30">←</button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === value.length - 1} aria-label="Sonraya" className="w-5 h-5 text-[11px] disabled:opacity-30">→</button>
              <button type="button" onClick={() => onChange(value.filter((v) => v !== id))} aria-label="Çıxar" className="w-5 h-5 text-[13px]">×</button>
            </li>
          ))}
        </ul>
      )}
      <div className="relative">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              if (term) (exact && !value.includes(exact.id) ? add(exact.id) : exact ? setQuery('') : createAndAdd())
            }
          }}
          disabled={full}
          placeholder="Komponent axtar və ya yeni yaz, Enter"
          className="w-full bg-cream border border-border rounded-lg px-3 py-2.5 text-[13.5px] focus:outline-none focus:ring-2 focus:ring-burgundy/30 disabled:opacity-50"
        />
        {term && (suggestions.length > 0 || !exact) && (
          <ul className="absolute z-10 left-0 right-0 mt-1 bg-panel border border-border rounded-lg shadow-lg max-h-56 overflow-y-auto">
            {suggestions.map((i) => (
              <li key={i.id}>
                <button type="button" onClick={() => add(i.id)} className="w-full text-left px-3 py-2 text-[13px] hover:bg-blush">{i.name}</button>
              </li>
            ))}
            {!exact && (
              <li>
                <button type="button" onClick={createAndAdd} disabled={busy} className="w-full text-left px-3 py-2 text-[13px] font-semibold text-burgundy hover:bg-blush">
                  + “{query.trim()}” yeni komponent kimi əlavə et
                </button>
              </li>
            )}
          </ul>
        )}
      </div>
    </div>
  )
}

export default IngredientPicker
