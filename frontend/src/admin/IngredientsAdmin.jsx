import { useEffect, useState } from 'react'
import { ingredientsApi } from '../lib/api'
import { useMenuStore } from '../store/menuStore'
import { useUiStore } from '../store/uiStore'

const FIELD = 'w-full bg-cream border border-border rounded-lg px-2.5 py-1.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-burgundy/30'

function Row({ ingredient, onSaved, onDeleted }) {
  const showToast = useUiStore((s) => s.showToast)
  const [form, setForm] = useState({ name: ingredient.name, name_en: ingredient.name_en || '', name_ru: ingredient.name_ru || '' })
  const dirty = form.name !== ingredient.name || form.name_en !== (ingredient.name_en || '') || form.name_ru !== (ingredient.name_ru || '')

  async function save() {
    try {
      onSaved(await ingredientsApi.update(ingredient.id, form))
      showToast('Saxlanıldı')
    } catch (err) {
      showToast(err.response?.data?.error || 'Xəta baş verdi', 'error')
    }
  }

  async function remove() {
    if (!confirm(`“${ingredient.name}” silinsin?`)) return
    try {
      await ingredientsApi.remove(ingredient.id)
      onDeleted(ingredient)
    } catch (err) {
      showToast(err.response?.data?.error || 'Silinmədi', 'error')
    }
  }

  return (
    <tr className="border-t border-border/60">
      <td className="py-1.5 pr-2"><input aria-label="AZ" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={FIELD} /></td>
      <td className="py-1.5 pr-2"><input aria-label="EN" value={form.name_en} onChange={(e) => setForm({ ...form, name_en: e.target.value })} className={FIELD} /></td>
      <td className="py-1.5 pr-2"><input aria-label="RU" value={form.name_ru} onChange={(e) => setForm({ ...form, name_ru: e.target.value })} className={FIELD} /></td>
      <td className="py-1.5 whitespace-nowrap">
        <button type="button" onClick={save} disabled={!dirty || !form.name.trim()} className="text-[12px] font-semibold text-burgundy px-2 disabled:opacity-30">Saxla</button>
        <button type="button" onClick={remove} className="text-[12px] font-semibold text-danger px-2">Sil</button>
      </td>
    </tr>
  )
}

function IngredientsAdmin() {
  const ingredients = useMenuStore((s) => s.ingredients)
  const upsertIngredient = useMenuStore((s) => s.upsertIngredient)
  const showToast = useUiStore((s) => s.showToast)
  const [draft, setDraft] = useState({ name: '', name_en: '', name_ru: '' })
  const [search, setSearch] = useState('')

  useEffect(() => {
    ingredientsApi.list().then((list) => useMenuStore.setState({ ingredients: list })).catch(() => {})
  }, [])

  async function add(e) {
    e.preventDefault()
    try {
      upsertIngredient(await ingredientsApi.create(draft), 'created')
      setDraft({ name: '', name_en: '', name_ru: '' })
    } catch (err) {
      showToast(err.response?.data?.error || 'Xəta baş verdi', 'error')
    }
  }

  const shown = ingredients.filter((i) => [i.name, i.name_en, i.name_ru].some((v) => v && v.toLowerCase().includes(search.trim().toLowerCase())))

  return (
    <div className="max-w-3xl">
      <h1 className="font-display text-[24px] font-semibold mb-1">Tərkib komponentləri</h1>
      <p className="text-[13px] text-muted mb-4">Məhsulların tərkibi buradakı kataloqdan seçilir; adı və ya tərcüməsini burada dəyişəndə bütün məhsullarda və müştəri ekranlarında dərhal yenilənir.</p>

      <form onSubmit={add} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1fr_auto] gap-2 mb-5 bg-panel border border-border/60 rounded-2xl p-3">
        <input required placeholder="Ad (AZ)" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className={FIELD} />
        <input placeholder="EN" value={draft.name_en} onChange={(e) => setDraft({ ...draft, name_en: e.target.value })} className={FIELD} />
        <input placeholder="RU" value={draft.name_ru} onChange={(e) => setDraft({ ...draft, name_ru: e.target.value })} className={FIELD} />
        <button type="submit" className="px-4 py-1.5 rounded-lg text-[13px] font-semibold bg-burgundy text-white">Əlavə et</button>
      </form>

      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Axtar" className="w-full mb-3 bg-panel border border-border rounded-full px-4 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-burgundy/30" />

      <div className="bg-panel border border-border/60 rounded-2xl p-3 overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="text-[11.5px] uppercase tracking-wide text-muted">
              <th className="pb-1.5 font-bold">AZ</th><th className="pb-1.5 font-bold">EN</th><th className="pb-1.5 font-bold">RU</th><th />
            </tr>
          </thead>
          <tbody>
            {shown.map((i) => (
              <Row key={`${i.id}-${i.name}-${i.name_en}-${i.name_ru}`} ingredient={i} onSaved={(u) => upsertIngredient(u, 'updated')} onDeleted={(d) => upsertIngredient(d, 'deleted')} />
            ))}
          </tbody>
        </table>
        {shown.length === 0 && <p className="text-muted text-[13px] py-4 text-center">Komponent tapılmadı</p>}
      </div>
    </div>
  )
}

export default IngredientsAdmin
