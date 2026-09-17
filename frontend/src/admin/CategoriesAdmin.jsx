import { useEffect, useState } from 'react'
import { categoriesApi } from '../lib/api'
import { useUiStore } from '../store/uiStore'
import Button from '../components/Button'

const emptyForm = { id: null, name: '', name_en: '', name_ru: '', slug: '', sort_order: 0, is_active: true }

function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function CategoriesAdmin() {
  const [categories, setCategories] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const showToast = useUiStore((s) => s.showToast)

  async function load() {
    setCategories(await categoriesApi.list(true))
  }

  useEffect(() => {
    load()
  }, [])

  function startEdit(cat) {
    setForm({ ...cat })
  }

  function startNew() {
    setForm(emptyForm)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      if (form.id) {
        await categoriesApi.update(form.id, form)
      } else {
        await categoriesApi.create(form)
      }
      showToast('Kateqoriya saxlanıldı')
      setForm(emptyForm)
      load()
    } catch (err) {
      showToast(err.response?.data?.error || 'Xəta baş verdi', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id) {
    if (!confirm('Bu kateqoriyanı silmək istədiyinizə əminsiniz?')) return
    try {
      await categoriesApi.remove(id)
      showToast('Kateqoriya silindi')
      load()
    } catch (err) {
      showToast(err.response?.data?.error || 'Silinərkən xəta baş verdi', 'error')
    }
  }

  return (
    <div className="grid md:grid-cols-[1fr_320px] gap-6">
      <div>
        <div className="flex items-center justify-between mb-5">
          <h1 className="font-display text-[24px] font-semibold">Kateqoriyalar</h1>
          <Button onClick={startNew}>+ Yeni</Button>
        </div>
        <div className="bg-panel rounded-2xl border border-border/60 overflow-hidden">
          {categories.map((cat) => (
            <div key={cat.id} className="flex items-center justify-between px-5 py-3.5 border-b border-border/60 last:border-0">
              <div>
                <p className="font-semibold text-[14px]">{cat.name}</p>
                <p className="text-[12px] text-muted">/{cat.slug} · sıra {cat.sort_order}{!cat.is_active ? ' · deaktiv' : ''}</p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => startEdit(cat)} className="text-[13px] font-semibold text-burgundy">Redaktə</button>
                <button onClick={() => handleDelete(cat.id)} className="text-[13px] font-semibold text-danger">Sil</button>
              </div>
            </div>
          ))}
          {categories.length === 0 && <p className="px-5 py-6 text-muted text-[13.5px]">Hələ kateqoriya yoxdur</p>}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-panel rounded-2xl border border-border/60 p-5 h-fit">
        <h2 className="font-semibold text-[15px] mb-4">{form.id ? 'Kateqoriyanı redaktə et' : 'Yeni kateqoriya'}</h2>
        <div className="flex flex-col gap-3">
          <div>
            <label className="text-[12px] font-semibold text-muted mb-1 block">Ad</label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value, slug: form.id ? form.slug : slugify(e.target.value) })}
              className="w-full bg-cream border border-border rounded-lg px-3 py-2.5 text-[13.5px] focus:outline-none focus:ring-2 focus:ring-burgundy/30"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[12px] font-semibold text-muted mb-1 block">Ad (EN)</label>
              <input
                value={form.name_en}
                onChange={(e) => setForm({ ...form, name_en: e.target.value })}
                className="w-full bg-cream border border-border rounded-lg px-3 py-2.5 text-[13.5px] focus:outline-none focus:ring-2 focus:ring-burgundy/30"
              />
            </div>
            <div>
              <label className="text-[12px] font-semibold text-muted mb-1 block">Ad (RU)</label>
              <input
                value={form.name_ru}
                onChange={(e) => setForm({ ...form, name_ru: e.target.value })}
                className="w-full bg-cream border border-border rounded-lg px-3 py-2.5 text-[13.5px] focus:outline-none focus:ring-2 focus:ring-burgundy/30"
              />
            </div>
          </div>
          <div>
            <label className="text-[12px] font-semibold text-muted mb-1 block">Slug</label>
            <input
              required
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value })}
              className="w-full bg-cream border border-border rounded-lg px-3 py-2.5 text-[13.5px] focus:outline-none focus:ring-2 focus:ring-burgundy/30"
            />
          </div>
          <div>
            <label className="text-[12px] font-semibold text-muted mb-1 block">Sıra</label>
            <input
              type="number"
              value={form.sort_order}
              onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })}
              className="w-full bg-cream border border-border rounded-lg px-3 py-2.5 text-[13.5px] focus:outline-none focus:ring-2 focus:ring-burgundy/30"
            />
          </div>
          <label className="flex items-center gap-2 text-[13px] font-semibold">
            <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
            Aktiv
          </label>
          <div className="flex gap-2 mt-1">
            <Button type="submit" disabled={saving} className="flex-1">{saving ? 'Saxlanılır...' : 'Saxla'}</Button>
            {form.id && <Button type="button" variant="outline" onClick={startNew}>Ləğv et</Button>}
          </div>
        </div>
      </form>
    </div>
  )
}

export default CategoriesAdmin
