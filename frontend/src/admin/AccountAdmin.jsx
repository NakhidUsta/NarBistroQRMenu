import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authApi } from '../lib/api'
import { useAuthStore } from '../store/authStore'
import { useUiStore } from '../store/uiStore'
import Button from '../components/Button'

// User-Agent sətrindən qısa "Brauzer · Sistem" təsviri
export function describeDevice(ua = '') {
  const has = (name) => ua.includes(`${name}/`)
  const browser = has('Edg') ? 'Edge' : has('OPR') ? 'Opera' : has('Firefox') ? 'Firefox' : has('Chrome') ? 'Chrome' : has('Safari') ? 'Safari' : 'Brauzer'
  const os = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad|iOS/.test(ua) ? 'iOS' : /Mac OS X/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : ''
  return os ? `${browser} · ${os}` : browser
}

const inputCls = 'w-full bg-cream border border-border rounded-lg px-3 py-2.5 text-[13.5px] focus:outline-none focus:ring-2 focus:ring-burgundy/30'

function AccountAdmin() {
  const navigate = useNavigate()
  const admin = useAuthStore((s) => s.admin)
  const showToast = useUiStore((s) => s.showToast)
  const [form, setForm] = useState({ current: '', next: '', repeat: '' })
  const [saving, setSaving] = useState(false)
  const [sessions, setSessions] = useState([])

  const loadSessions = useCallback(() => authApi.sessions().then(setSessions).catch(() => {}), [])
  useEffect(() => {
    loadSessions()
  }, [loadSessions])

  async function revoke(id) {
    if (!confirm('Bu cihazdan çıxış edilsin?')) return
    try {
      await authApi.revokeSession(id)
      showToast('Cihaz sessiyası bağlandı')
      loadSessions()
    } catch (err) {
      showToast(err.response?.data?.error || 'Bağlanmadı', 'error')
    }
  }

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
        <p className="text-[12.5px] text-muted mb-3">Giriş etdiyiniz cihazlar. Sessiya 12 saat fəaliyyətsiz qalanda (və ən çox 7 gün) avtomatik başa çatır. Tanımadığınız cihaz görsəniz onu bağlayın; cihazınız itibsə hamısını bağlayın.</p>
        <ul className="flex flex-col gap-2 mb-4" data-testid="session-list">
          {sessions.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 border border-border/60 rounded-xl px-3 py-2.5">
              <div className="min-w-0">
                <p className="text-[13px] font-semibold truncate">
                  {describeDevice(s.user_agent)}
                  {s.current && <span className="ml-2 text-[10.5px] font-bold uppercase text-success">Bu cihaz</span>}
                </p>
                <p className="text-[11.5px] text-muted truncate">{s.ip || '—'} · son fəaliyyət {new Date(s.last_used_at).toLocaleString('az-AZ')}</p>
              </div>
              {!s.current && (
                <button type="button" onClick={() => revoke(s.id)} className="text-[12px] font-bold text-danger shrink-0">Bağla</button>
              )}
            </li>
          ))}
        </ul>
        <Button variant="outline" onClick={logoutEverywhere}>Bütün cihazlardan çıxış et</Button>
      </div>
    </div>
  )
}

export default AccountAdmin
