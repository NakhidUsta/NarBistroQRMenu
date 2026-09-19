import { useEffect, useState } from 'react'
import { productsApi, categoriesApi, ingredientsApi, imageVariants, resolveUploadUrl } from '../lib/api'
import { useMenuStore } from '../store/menuStore'
import { useUiStore } from '../store/uiStore'
import Button from '../components/Button'
import ImageGalleryField from './ImageGalleryField'
import AllergenPicker from './AllergenPicker'
import IngredientPicker from './IngredientPicker'
import TranslationTabs from './TranslationTabs'

const emptyForm = {
  id: null, category_id: '', name: '', name_en: '', name_ru: '',
  description: '', description_en: '', description_ru: '', price: '', image_url: '', images: [], allergen_ids: [], ingredient_ids: [],
  ingredients: '', ingredients_en: '', ingredients_ru: '',
  allergens: '', allergens_en: '', allergens_ru: '',
  prep_time_minutes: '', is_available: true, is_popular: false, sort_order: 0,
  track_inventory: false, stock_quantity: '',
}

function MenuAdmin() {
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const showToast = useUiStore((s) => s.showToast)

  async function load() {
    const [p, c, ingredients] = await Promise.all([productsApi.list(), categoriesApi.list(true), ingredientsApi.list().catch(() => null)])
    setProducts(p)
    setCategories(c)
    if (ingredients) useMenuStore.setState({ ingredients })
  }

  useEffect(() => {
    load()
  }, [])

  function startEdit(product) {
    setForm({ ...emptyForm, ...product, category_id: product.category_id ?? '' })
  }

  function startNew() {
    setForm({ ...emptyForm, category_id: categories[0]?.id ?? '' })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = { ...form, category_id: Number(form.category_id), price: Number(form.price) }
      if (form.id) {
        await productsApi.update(form.id, payload)
      } else {
        await productsApi.create(payload)
      }
      showToast('Məhsul saxlanıldı')
      setForm(emptyForm)
      load()
    } catch (err) {
      showToast(err.response?.data?.error || 'Xəta baş verdi', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function toggleAvailability(product) {
    await productsApi.setAvailability(product.id, !product.is_available)
    load()
  }

  async function adjustStock(product, delta) {
    await productsApi.adjustStock(product.id, delta)
    load()
  }

  async function handleDelete(id) {
    if (!confirm('Bu məhsulu silmək istədiyinizə əminsiniz?')) return
    await productsApi.remove(id)
    showToast('Məhsul silindi')
    load()
  }

  return (
    <div className="grid md:grid-cols-[1fr_360px] gap-6">
      <div>
        <div className="flex items-center justify-between mb-5">
          <h1 className="font-display text-[24px] font-semibold">Menyu</h1>
          <Button onClick={startNew}>+ Yeni məhsul</Button>
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Məhsul axtar (ad, kateqoriya)"
          className="w-full mb-4 bg-panel border border-border rounded-full px-4 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-burgundy/30"
        />
        <div className="flex flex-col gap-3">
          {products.filter((p) => {
            const s = search.trim().toLowerCase()
            if (!s) return true
            const cat = categories.find((c) => c.id === p.category_id)?.name || ''
            return [p.name, p.name_en, p.name_ru, cat].some((v) => v && v.toLowerCase().includes(s))
          }).map((p) => (
            <div key={p.id} className={`flex gap-4 bg-panel rounded-2xl p-3 border border-border/60 ${!p.is_available ? 'opacity-60' : ''}`}>
              <img src={resolveUploadUrl(imageVariants(p.image_url)?.thumb || p.image_url)} alt="" className="w-16 h-16 rounded-xl object-cover bg-blush" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-[14px]">{p.name}</p>
                <p className="text-[12px] text-muted">{categories.find((c) => c.id === p.category_id)?.name || '—'} · {Number(p.price).toFixed(2)} ₼</p>
                {p.track_inventory && (
                  <div className="flex items-center gap-1.5 mt-1">
                    <button onClick={() => adjustStock(p, -1)} className="w-5 h-5 rounded-full bg-cream border border-border text-[11px] flex items-center justify-center">−</button>
                    <span className="text-[11.5px] font-semibold text-muted w-16 text-center">{p.stock_quantity ?? 0} ədəd</span>
                    <button onClick={() => adjustStock(p, 1)} className="w-5 h-5 rounded-full bg-cream border border-border text-[11px] flex items-center justify-center">+</button>
                  </div>
                )}
              </div>
              <div className="flex flex-col items-end gap-1.5 text-[12.5px] font-semibold shrink-0">
                <button onClick={() => toggleAvailability(p)} className={p.is_available ? 'text-success' : 'text-danger'}>
                  {p.is_available ? 'Mövcuddur' : 'Bitib'}
                </button>
                <button onClick={() => startEdit(p)} className="text-burgundy">Redaktə</button>
                <button onClick={() => handleDelete(p.id)} className="text-danger">Sil</button>
              </div>
            </div>
          ))}
          {products.length === 0 && <p className="text-muted text-[13.5px]">Hələ məhsul yoxdur</p>}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-panel rounded-2xl border border-border/60 p-5 h-fit flex flex-col gap-3">
        <h2 className="font-semibold text-[15px]">{form.id ? 'Məhsulu redaktə et' : 'Yeni məhsul'}</h2>

        <TranslationTabs
          fields={[{ key: 'name', label: 'Ad', required: true }]}
          form={form}
          setForm={setForm}
        />
        <div>
          <label className="text-[12px] font-semibold text-muted mb-1 block">Kateqoriya</label>
          <select required value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}
            className="w-full bg-cream border border-border rounded-lg px-3 py-2.5 text-[13.5px] focus:outline-none focus:ring-2 focus:ring-burgundy/30">
            <option value="">Seçin</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[12px] font-semibold text-muted mb-1 block">Qiymət (₼)</label>
          <input required type="number" step="0.01" min="0" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })}
            className="w-full bg-cream border border-border rounded-lg px-3 py-2.5 text-[13.5px] focus:outline-none focus:ring-2 focus:ring-burgundy/30" />
        </div>
        <TranslationTabs
          fields={[{ key: 'description', label: 'Təsvir', type: 'textarea' }]}
          form={form}
          setForm={setForm}
        />
        <ImageGalleryField value={form.images} onChange={(images) => setForm({ ...form, images, image_url: images[0] || '' })} />
        <AllergenPicker value={form.allergen_ids} onChange={(allergen_ids) => setForm({ ...form, allergen_ids })} />
        <IngredientPicker value={form.ingredient_ids} onChange={(ingredient_ids) => setForm({ ...form, ingredient_ids })} />
        <TranslationTabs
          fields={[{ key: 'allergens', label: 'Digər allergen qeydləri (vergüllə ayırın)' }]}
          form={form}
          setForm={setForm}
        />
        <div>
          <label className="text-[12px] font-semibold text-muted mb-1 block">Hazırlanma vaxtı (dəq)</label>
          <input type="number" min="0" value={form.prep_time_minutes} onChange={(e) => setForm({ ...form, prep_time_minutes: e.target.value })}
            className="w-full bg-cream border border-border rounded-lg px-3 py-2.5 text-[13.5px] focus:outline-none focus:ring-2 focus:ring-burgundy/30" />
        </div>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-[13px] font-semibold">
            <input type="checkbox" checked={form.is_available} onChange={(e) => setForm({ ...form, is_available: e.target.checked })} />
            Mövcuddur
          </label>
          <label className="flex items-center gap-2 text-[13px] font-semibold">
            <input type="checkbox" checked={form.is_popular} onChange={(e) => setForm({ ...form, is_popular: e.target.checked })} />
            Populyar
          </label>
        </div>
        <div className="border-t border-border pt-3">
          <label className="flex items-center gap-2 text-[13px] font-semibold mb-2">
            <input type="checkbox" checked={form.track_inventory} onChange={(e) => setForm({ ...form, track_inventory: e.target.checked })} />
            Stok izlənsin
          </label>
          {form.track_inventory && (
            <div>
              <label className="text-[12px] font-semibold text-muted mb-1 block">Başlanğıc stok</label>
              <input type="number" min="0" value={form.stock_quantity} onChange={(e) => setForm({ ...form, stock_quantity: e.target.value })}
                className="w-full bg-cream border border-border rounded-lg px-3 py-2.5 text-[13.5px] focus:outline-none focus:ring-2 focus:ring-burgundy/30" />
            </div>
          )}
        </div>
        <div className="flex gap-2 mt-1">
          <Button type="submit" disabled={saving} className="flex-1">{saving ? 'Saxlanılır...' : 'Saxla'}</Button>
          {form.id && <Button type="button" variant="outline" onClick={startNew}>Ləğv et</Button>}
        </div>
      </form>
    </div>
  )
}

export default MenuAdmin
