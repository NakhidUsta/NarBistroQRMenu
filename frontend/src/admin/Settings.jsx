import { useEffect, useState } from 'react'
import { useRestaurantStore } from '../store/restaurantStore'
import { useUiStore } from '../store/uiStore'
import Button from '../components/Button'
import ImageUploadField from './ImageUploadField'
import TranslationTabs from './TranslationTabs'

function InstagramBioLink() {
  const showToast = useUiStore((s) => s.showToast)
  const link = `${window.location.origin}/menyu`

  function copy() {
    navigator.clipboard.writeText(link)
    showToast('Link kopyalandı')
  }

  return (
    <div className="bg-panel rounded-2xl border border-border/60 p-6 mt-6">
      <h2 className="font-semibold text-[15px] mb-1">Instagram Bio Linki</h2>
      <p className="text-[12.5px] text-muted mb-3">
        Bu link heç bir masaya bağlı deyil — Instagram/Facebook bio-ya və ya WhatsApp-a qoyula bilər.
      </p>
      <div className="flex gap-2">
        <input readOnly value={link} className="flex-1 bg-cream border border-border rounded-lg px-3 py-2.5 text-[13px] text-muted" />
        <Button type="button" variant="outline" onClick={copy}>Linki kopyala</Button>
      </div>
    </div>
  )
}

const FIELDS = [
  ['phone', 'Telefon'],
  ['whatsapp', 'WhatsApp'],
  ['address', 'Ünvan'],
  ['working_hours', 'İş saatları'],
  ['email', 'E-poçt'],
  ['google_maps_link', 'Google Maps linki'],
  ['instagram_link', 'Instagram linki'],
  ['facebook_link', 'Facebook linki'],
  ['tiktok_link', 'TikTok linki'],
]

function Settings() {
  const restaurant = useRestaurantStore((s) => s.restaurant)
  const fetchRestaurant = useRestaurantStore((s) => s.fetch)
  const update = useRestaurantStore((s) => s.update)
  const showToast = useUiStore((s) => s.showToast)
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchRestaurant()
  }, [])

  useEffect(() => {
    if (restaurant) setForm(restaurant)
  }, [restaurant])

  if (!form) return <p className="text-muted">Yüklənir...</p>

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await update(form)
      showToast('Ayarlar saxlanıldı')
    } catch (err) {
      showToast(err.response?.data?.error || 'Xəta baş verdi', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-xl">
      <h1 className="font-display text-[24px] font-semibold mb-5">Restoran ayarları</h1>
      <form onSubmit={handleSubmit} className="bg-panel rounded-2xl border border-border/60 p-6 flex flex-col gap-4">
        <ImageUploadField label="Loqo" value={form.logo_url} onChange={(url) => setForm({ ...form, logo_url: url })} />

        <TranslationTabs
          fields={[{ key: 'name', label: 'Restoran adı', required: true }]}
          form={form}
          setForm={setForm}
        />

        {FIELDS.map(([key, label]) => (
          <div key={key}>
            <label className="text-[12px] font-semibold text-muted mb-1 block">{label}</label>
            <input
              value={form[key] || ''}
              onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              className="w-full bg-cream border border-border rounded-lg px-3 py-2.5 text-[13.5px] focus:outline-none focus:ring-2 focus:ring-burgundy/30"
            />
          </div>
        ))}

        <TranslationTabs
          fields={[{ key: 'about_text', label: 'Haqqımızda', type: 'textarea' }]}
          form={form}
          setForm={setForm}
        />

        <label className="flex items-center gap-2 text-[13px] font-semibold">
          <input
            type="checkbox"
            checked={!!form.allow_tableless_orders}
            onChange={(e) => setForm({ ...form, allow_tableless_orders: e.target.checked })}
          />
          Masasız istifadəçilərə sifariş icazəsi (ümumi /menyu linki üçün)
        </label>

        <Button type="submit" disabled={saving}>{saving ? 'Saxlanılır...' : 'Saxla'}</Button>
      </form>

      <InstagramBioLink />
    </div>
  )
}

export default Settings
