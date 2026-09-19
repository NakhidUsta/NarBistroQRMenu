import { useEffect, useState } from 'react'
import { useRestaurantStore } from '../store/restaurantStore'
import { useUiStore } from '../store/uiStore'
import Button from '../components/Button'
import ImageUploadField from './ImageUploadField'
import TranslationTabs from './TranslationTabs'
import { parseTheme, DEFAULT_THEME, FONT_OPTIONS, applyFavicon } from '../lib/theme'
import { imageVariants, resolveUploadUrl } from '../lib/api'
import { shareLink } from '../lib/share'

const fieldCls = 'w-full bg-cream border border-border rounded-lg px-3 py-2.5 text-[13.5px] focus:outline-none focus:ring-2 focus:ring-burgundy/30'

// Dizayn parametrləri form.theme-də JSON kimi saxlanılır; dəyişiklik saxla-dan sonra canlı sayta yayılır.
function ThemeEditor({ form, setForm }) {
  const theme = { ...DEFAULT_THEME, ...parseTheme(form.theme) }
  const set = (patch) => setForm({ ...form, theme: JSON.stringify({ ...theme, ...patch }) })

  return (
    <div className="border border-border rounded-xl p-4 bg-cream/50 flex flex-col gap-3">
      <h3 className="font-semibold text-[14px]">Dizayn</h3>
      <div className="grid grid-cols-3 gap-3">
        {[['primary', 'Əsas rəng'], ['background', 'Fon rəngi'], ['button', 'Düymə rəngi']].map(([key, label]) => (
          <div key={key}>
            <label className="text-[11.5px] font-semibold text-muted mb-1 block">{label}</label>
            <div className="flex items-center gap-2 bg-panel border border-border rounded-lg px-2 py-1.5">
              <input type="color" value={theme[key]} onChange={(e) => set({ [key]: e.target.value })} className="w-7 h-7 rounded cursor-pointer border-0 bg-transparent p-0" />
              <span className="text-[11.5px] font-mono text-muted">{theme[key]}</span>
            </div>
          </div>
        ))}
      </div>
      <div>
        <label className="text-[11.5px] font-semibold text-muted mb-1 block">Başlıq şrifti</label>
        <select value={theme.font} onChange={(e) => set({ font: e.target.value })} className={fieldCls} style={{ fontFamily: `"${theme.font}", serif` }}>
          {FONT_OPTIONS.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
      </div>
      <ImageUploadField label="Hero şəkli (ana səhifə)" value={theme.hero_image_url} onChange={(url) => set({ hero_image_url: url })} />
      {[['hero_title', 'Hero başlığı'], ['hero_subtitle', 'Hero alt mətni'], ['banner_text', 'Banner mətni (aksiya/elan)'], ['footer_text', 'Footer mətni']].map(([key, label]) => (
        <div key={key}>
          <label className="text-[11.5px] font-semibold text-muted mb-1 block">{label}</label>
          <input value={theme[key] || ''} onChange={(e) => set({ [key]: e.target.value })} className={fieldCls} />
        </div>
      ))}
      <button type="button" onClick={() => setForm({ ...form, theme: null })} className="text-[12px] font-semibold text-danger self-start">
        Defolt dizayna qayıt
      </button>
    </div>
  )
}

export function InstagramBioLink() {
  const showToast = useUiStore((s) => s.showToast)
  const restaurant = useRestaurantStore((s) => s.restaurant)
  const link = `${window.location.origin}/menyu`

  async function copy() {
    try {
      await navigator.clipboard.writeText(link)
      showToast('Link kopyalandı')
    } catch {
      showToast('Kopyalamaq mümkün olmadı — linki əl ilə seçin', 'error')
    }
  }

  // Instagram-ın veb paylaşım intent-i yoxdur: mobildə sistem paylaşım pəncərəsi (Instagram orada seçilir), digər yerdə link kopyalanır
  async function share() {
    const result = await shareLink({ title: restaurant?.name || 'Menyu', text: `${restaurant?.name || ''} — rəqəmsal menyu`.trim(), url: link })
    if (result === 'copied') showToast('Link kopyalandı — Instagram bio-ya və ya story-yə yapışdırın')
    else if (result === 'failed') showToast('Paylaşmaq mümkün olmadı', 'error')
  }

  return (
    <div className="bg-panel rounded-2xl border border-border/60 p-6 mt-6">
      <h2 className="font-semibold text-[15px] mb-1">Instagram Bio Linki</h2>
      <p className="text-[12.5px] text-muted mb-3">
        Bu link heç bir masaya bağlı deyil — Instagram/Facebook bio-ya və ya WhatsApp-a qoyula bilər.
      </p>
      <div className="flex flex-wrap gap-2">
        <input readOnly value={link} className="flex-1 min-w-[200px] bg-cream border border-border rounded-lg px-3 py-2.5 text-[13px] text-muted" />
        <Button type="button" variant="outline" onClick={copy}>Linki kopyala</Button>
        <Button type="button" onClick={share}>Instagram-da paylaş</Button>
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

// Müştəriyə hansı ödəniş üsulları təklif olunur. Onlayn kart üçün serverdə provayder (Epoint) qoşulmalıdır (.env).
function PaymentMethodsEditor({ form, setForm }) {
  const rows = [
    ['pay_cash', 'Nağd', 'Müştəri sifarişi təhvil alanda nağd ödəyir'],
    ['pay_card_pos', 'Kartla (masada terminalla)', 'Ofisiant kart terminalını gətirir'],
  ]
  const online = !!form.online_payment_available
  return (
    <div className="border border-border rounded-xl p-4 bg-cream/50 flex flex-col gap-2.5" data-testid="payment-settings">
      <h3 className="font-semibold text-[14px]">Ödəniş üsulları</h3>
      {rows.map(([key, label, hint]) => (
        <label key={key} className="flex items-start gap-2.5 text-[13px]">
          <input type="checkbox" className="mt-0.5" checked={form[key] !== false} onChange={(e) => setForm({ ...form, [key]: e.target.checked })} />
          <span><span className="font-semibold">{label}</span><span className="block text-[11.5px] text-muted">{hint}</span></span>
        </label>
      ))}
      <label className={`flex items-start gap-2.5 text-[13px] ${online ? '' : 'opacity-60'}`}>
        <input type="checkbox" className="mt-0.5" disabled={!online} checked={!!form.pay_online && online} onChange={(e) => setForm({ ...form, pay_online: e.target.checked })} />
        <span>
          <span className="font-semibold">Onlayn kart ödənişi</span>
          <span className="block text-[11.5px] text-muted">Müştəri sifarişi verəndə kartla dərhal ödəyir; ödəniş təsdiqlənəndən sonra sifariş mətbəxə çatır.</span>
        </span>
      </label>
      {!online && (
        <p className="text-[11.5px] text-danger bg-danger/5 rounded-lg px-3 py-2" role="note">
          Onlayn ödəniş provayderi qoşulmayıb. Serverin <code>.env</code> faylında <code>PAYMENT_PROVIDER=epoint</code>, <code>EPOINT_PUBLIC_KEY</code> və <code>EPOINT_PRIVATE_KEY</code> təyin edin (epoint.az merchant hesabı lazımdır), sonra serveri yenidən başladın.
        </p>
      )}
      <p className="text-[11.5px] text-muted">Kart məlumatları (nömrə, CVV) bu sistemdən keçmir və saxlanılmır — kart səhifəsi provayderdədir. Ödənilməyən onlayn sifariş 30 dəqiqədən sonra avtomatik ləğv edilir.</p>
    </div>
  )
}

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
      const saved = await update(form)
      // brauzer tabındakı ikon dərhal yenilənir (müştəri səhifələrində socket ilə avtomatik gəlir)
      applyFavicon(saved?.favicon_url ? resolveUploadUrl(imageVariants(saved.favicon_url)?.thumb || saved.favicon_url) : null)
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
        <ImageUploadField label="Favicon (brauzer tabında görünən kiçik ikon — kvadrat şəkil)" value={form.favicon_url} onChange={(url) => setForm({ ...form, favicon_url: url })} />

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

        <div className="border border-border rounded-xl p-4 bg-cream/50 flex flex-col gap-3">
          <h3 className="font-semibold text-[14px]">Vergi və haqlar (hesablama backend-də aparılır)</h3>
          <div className="grid grid-cols-2 gap-3">
            {[['vat_percent', 'ƏDV (%)', '0.01'], ['service_fee_percent', 'Servis haqqı (%)', '0.01'], ['delivery_fee', 'Çatdırılma haqqı (takeaway)', '0.01']].map(([key, label, step]) => (
              <div key={key}>
                <label className="text-[11.5px] font-semibold text-muted mb-1 block">{label}</label>
                <input type="number" min="0" step={step} max={key === 'delivery_fee' ? undefined : 100} value={form[key] ?? 0} onChange={(e) => setForm({ ...form, [key]: e.target.value })} className={fieldCls} />
              </div>
            ))}
            <div>
              <label className="text-[11.5px] font-semibold text-muted mb-1 block">Valyuta kodu</label>
              <input maxLength={3} value={form.currency || 'AZN'} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} className={fieldCls} />
            </div>
          </div>
          <p className="text-[11.5px] text-muted">Qiymətlər ƏDV-siz hesab olunur; servis haqqı endirimli məbləğə, ƏDV isə (məbləğ + servis) üzərinə əlavə edilir. Çatdırılma yalnız masasız sifarişlərə.</p>
        </div>

        <PaymentMethodsEditor form={form} setForm={setForm} />

        <ThemeEditor form={form} setForm={setForm} />

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
