import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authApi } from '../lib/api'
import { useAuthStore } from '../store/authStore'
import { useUiStore } from '../store/uiStore'
import Button from '../components/Button'

const inputCls = 'w-full bg-cream border border-border rounded-lg px-3 py-2.5 text-[13.5px] focus:outline-none focus:ring-2 focus:ring-burgundy/30'

function AccountAdmin() {
  const navigate = useNavigate()
  const admin = useAuthStore((s) => s.admin)
  const showToast = useUiStore((s) => s.showToast)
  const [form, setForm] = useState({ current: '', next: '', repeat: '' })
  const [saving, setSaving] = useState(false)

  async function changePassword(e) {
    e.preventDefault()
    if (form.next !== form.repeat) {
      showToast('Yeni şifrələr uyğun gəlmir', 'error')
      return
    }
    setSaving(true)
    try {
      const { message } = await authApi.changePassword(form.current, form.next)
      setForm({ current: '', next: '', repeat: '' })
      showToast(message)
    } catch (err) {
      showToast(err.response?.data?.error || 'Şifrə dəyişmədi', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function logoutEverywhere() {
    if (!confirm('Bütün cihazlardan (bu cihaz da daxil) çıxış edilsin?')) return
    await authApi.logoutAll()
    useAuthStore.setState({ admin: null })
    navigate('/admin/login')
  }

  return (
    <div className="max-w-md">
      <h1 className="font-display text-[24px] font-semibold mb-1">Hesabım</h1>
      <p className="text-[13px] text-muted mb-5">{admin?.email} · <span className="font-semibold text-burgundy">{admin?.role}</span></p>

      <form onSubmit={changePassword} className="bg-panel rounded-2xl border border-border/60 p-5 flex flex-col gap-3 mb-5">
        <h2 className="font-semibold text-[15px]">Şifrəni dəyiş</h2>
        <div>
          <label className="text-[12px] font-semibold text-muted mb-1 block">Cari şifrə</label>
          <input required type="password" autoComplete="current-password" value={form.current} onChange={(e) => setForm({ ...form, current: e.target.value })} className={inputCls} />
        </div>
        <div>
          <label className="text-[12px] font-semibold text-muted mb-1 block">Yeni şifrə (min 8 simvol)</label>
          <input required minLength={8} type="password" autoComplete="new-password" value={form.next} onChange={(e) => setForm({ ...form, next: e.target.value })} className={inputCls} />
        </div>
        <div>
          <label className="text-[12px] font-semibold text-muted mb-1 block">Yeni şifrə (təkrar)</label>
          <input required minLength={8} type="password" autoComplete="new-password" value={form.repeat} onChange={(e) => setForm({ ...form, repeat: e.target.value })} className={inputCls} />
        </div>
        <p className="text-[11.5px] text-muted">Şifrə dəyişəndə bu cihaz açıq qalır, digər bütün cihazlardan çıxış edilir.</p>
        <Button type="submit" disabled={saving}>{saving ? 'Saxlanılır...' : 'Şifrəni dəyiş'}</Button>
      </form>

      <div className="bg-panel rounded-2xl border border-border/60 p-5">
        <h2 className="font-semibold text-[15px] mb-1">Sessiyalar</h2>
        <p className="text-[12.5px] text-muted mb-3">Sessiya 12 saatdan sonra avtomatik başa çatır. Cihazınız itibsə bütün sessiyaları bağlayın.</p>
        <Button variant="outline" onClick={logoutEverywhere}>Bütün cihazlardan çıxış et</Button>
      </div>
    </div>
  )
}

export default AccountAdmin
