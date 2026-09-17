import { useEffect, useState } from 'react'
import { promosApi } from '../lib/api'
import { useUiStore } from '../store/uiStore'
import Button from '../components/Button'

const emptyForm = {
  id: null, code: '', discount_type: 'PERCENT', discount_value: '', min_order_amount: 0,
  starts_at: '', ends_at: '', usage_limit: '', is_active: true,
}

function toInputDate(value) {
  return value ? value.slice(0, 10) : ''
}

function PromotionsAdmin() {
  const [promos, setPromos] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const showToast = useUiStore((s) => s.showToast)

  async function load() {
    setPromos(await promosApi.list())
  }

  useEffect(() => {
    load()
  }, [])

  function startNew() {
    setForm(emptyForm)
  }

  function startEdit(p) {
    setForm({
      ...p,
      starts_at: toInputDate(p.starts_at),
      ends_at: toInputDate(p.ends_at),
      usage_limit: p.usage_limit ?? '',
    })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = {
        ...form,
        discount_value: Number(form.discount_value),
        min_order_amount: Number(form.min_order_amount) || 0,
        usage_limit: form.usage_limit === '' ? null : Number(form.usage_limit),
        starts_at: form.starts_at || null,
        ends_at: form.ends_at || null,
      }
      if (form.id) {
        await promosApi.update(form.id, payload)
      } else {
        await promosApi.create(payload)
      }
      showToast('Promo kod saxlanıldı')
      setForm(emptyForm)
      load()
    } catch (err) {
      showToast(err.response?.data?.error || 'Xəta baş verdi', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(p) {
    await promosApi.update(p.id, { ...p, is_active: !p.is_active })
    load()
  }

  async function handleDelete(id) {
    if (!confirm('Bu promo kodu silmək istədiyinizə əminsiniz?')) return
    await promosApi.remove(id)
    load()
  }

  return (
    <div className="grid md:grid-cols-[1fr_340px] gap-6">
      <div>
        <div className="flex items-center justify-between mb-5">
          <h1 className="font-display text-[24px] font-semibold">Promosyonlar</h1>
          <Button onClick={startNew}>+ Yeni kod</Button>
        </div>
        <div className="flex flex-col gap-3">
          {promos.map((p) => (
            <div key={p.id} className={`bg-panel rounded-2xl border border-border/60 p-4 flex items-center gap-4 ${!p.is_active ? 'opacity-60' : ''}`}>
              <div className="flex-1 min-w-0">
                <p className="font-display font-bold text-[16px] text-burgundy">{p.code}</p>
                <p className="text-[12px] text-muted">
                  {p.discount_type === 'PERCENT' ? `${Number(p.discount_value)}%` : `${Number(p.discount_value).toFixed(2)} ₼`} endirim
                  {Number(p.min_order_amount) > 0 && ` · min ${Number(p.min_order_amount).toFixed(2)} ₼`}
                  {p.usage_limit ? ` · ${p.usage_count}/${p.usage_limit} istifadə` : ` · ${p.usage_count} istifadə`}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1.5 text-[12.5px] font-semibold shrink-0">
                <button onClick={() => toggleActive(p)} className={p.is_active ? 'text-success' : 'text-danger'}>
                  {p.is_active ? 'Aktiv' : 'Deaktiv'}
                </button>
                <button onClick={() => startEdit(p)} className="text-burgundy">Redaktə</button>
                <button onClick={() => handleDelete(p.id)} className="text-danger">Sil</button>
              </div>
            </div>
          ))}
          {promos.length === 0 && <p className="text-muted text-[13.5px]">Hələ promo kod yoxdur</p>}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-panel rounded-2xl border border-border/60 p-5 h-fit flex flex-col gap-3">
        <h2 className="font-semibold text-[15px]">{form.id ? 'Kodu redaktə et' : 'Yeni promo kod'}</h2>

        <div>
          <label className="text-[12px] font-semibold text-muted mb-1 block">Kod</label>
          <input required disabled={!!form.id} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
            className="w-full bg-cream border border-border rounded-lg px-3 py-2.5 text-[13.5px] uppercase focus:outline-none focus:ring-2 focus:ring-burgundy/30 disabled:opacity-60" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[12px] font-semibold text-muted mb-1 block">Tip</label>
            <select value={form.discount_type} onChange={(e) => setForm({ ...form, discount_type: e.target.value })}
              className="w-full bg-cream border border-border rounded-lg px-3 py-2.5 text-[13.5px] focus:outline-none focus:ring-2 focus:ring-burgundy/30">
              <option value="PERCENT">Faiz (%)</option>
              <option value="FIXED">Sabit (₼)</option>
            </select>
          </div>
          <div>
            <label className="text-[12px] font-semibold text-muted mb-1 block">Dəyər</label>
            <input required type="number" step="0.01" min="0" value={form.discount_value} onChange={(e) => setForm({ ...form, discount_value: e.target.value })}
              className="w-full bg-cream border border-border rounded-lg px-3 py-2.5 text-[13.5px] focus:outline-none focus:ring-2 focus:ring-burgundy/30" />
          </div>
        </div>
        <div>
          <label className="text-[12px] font-semibold text-muted mb-1 block">Minimum sifariş (₼)</label>
          <input type="number" step="0.01" min="0" value={form.min_order_amount} onChange={(e) => setForm({ ...form, min_order_amount: e.target.value })}
            className="w-full bg-cream border border-border rounded-lg px-3 py-2.5 text-[13.5px] focus:outline-none focus:ring-2 focus:ring-burgundy/30" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[12px] font-semibold text-muted mb-1 block">Başlama tarixi</label>
            <input type="date" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })}
              className="w-full bg-cream border border-border rounded-lg px-3 py-2.5 text-[13.5px] focus:outline-none focus:ring-2 focus:ring-burgundy/30" />
          </div>
          <div>
            <label className="text-[12px] font-semibold text-muted mb-1 block">Bitmə tarixi</label>
            <input type="date" value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })}
              className="w-full bg-cream border border-border rounded-lg px-3 py-2.5 text-[13.5px] focus:outline-none focus:ring-2 focus:ring-burgundy/30" />
          </div>
        </div>
        <div>
          <label className="text-[12px] font-semibold text-muted mb-1 block">İstifadə limiti (boş = limitsiz)</label>
          <input type="number" min="1" value={form.usage_limit} onChange={(e) => setForm({ ...form, usage_limit: e.target.value })}
            className="w-full bg-cream border border-border rounded-lg px-3 py-2.5 text-[13.5px] focus:outline-none focus:ring-2 focus:ring-burgundy/30" />
        </div>
        <label className="flex items-center gap-2 text-[13px] font-semibold">
          <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
          Aktiv
        </label>
        <div className="flex gap-2 mt-1">
          <Button type="submit" disabled={saving} className="flex-1">{saving ? 'Saxlanılır...' : 'Saxla'}</Button>
          {form.id && <Button type="button" variant="outline" onClick={startNew}>Ləğv et</Button>}
        </div>
      </form>
    </div>
  )
}

export default PromotionsAdmin
