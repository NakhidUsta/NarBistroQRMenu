import { useEffect, useState } from 'react'
import { staffApi } from '../lib/api'
import { useAuthStore } from '../store/authStore'
import { useUiStore } from '../store/uiStore'
import Button from '../components/Button'

const ROLES = [
  ['OWNER', 'Owner — tam giriş'],
  ['MANAGER', 'Manager — menyu, sifariş, masa'],
  ['WAITER', 'Waiter — sifariş, çağırışlar'],
  ['KITCHEN', 'Kitchen — yalnız mətbəx'],
]

const emptyForm = { id: null, email: '', password: '', role: 'WAITER' }
const inputCls = 'w-full bg-cream border border-border rounded-lg px-3 py-2.5 text-[13.5px] focus:outline-none focus:ring-2 focus:ring-burgundy/30'

function StaffAdmin() {
  const me = useAuthStore((s) => s.admin)
  const showToast = useUiStore((s) => s.showToast)
  const [staff, setStaff] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  async function load() {
    setStaff(await staffApi.list())
  }

  useEffect(() => {
    load()
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      if (form.id) await staffApi.update(form.id, { role: form.role, password: form.password || undefined })
      else await staffApi.create(form)
      showToast('İstifadəçi saxlanıldı')
      setForm(emptyForm)
      load()
    } catch (err) {
      showToast(err.response?.data?.error || 'Xəta baş verdi', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(u) {
    if (!confirm(`${u.email} silinsin?`)) return
    try {
      await staffApi.remove(u.id)
      load()
    } catch (err) {
      showToast(err.response?.data?.error || 'Silinmədi', 'error')
    }
  }

  return (
    <div className="grid md:grid-cols-[1fr_320px] gap-6">
      <div>
        <h1 className="font-display text-[24px] font-semibold mb-5">İşçilər</h1>
        <div className="bg-panel rounded-2xl border border-border/60 overflow-hidden">
          {staff.map((u) => (
            <div key={u.id} className="flex items-center justify-between px-5 py-3.5 border-b border-border/60 last:border-0">
              <div>
                <p className="font-semibold text-[14px]">{u.email}{u.id === me?.id && <span className="text-muted font-normal"> (siz)</span>}</p>
                <p className="text-[12px] text-burgundy font-semibold">{u.role}</p>
              </div>
              <div className="flex gap-3 text-[13px] font-semibold">
                <button onClick={() => setForm({ id: u.id, email: u.email, password: '', role: u.role })} className="text-burgundy">Redaktə</button>
                {u.id !== me?.id && <button onClick={() => handleDelete(u)} className="text-danger">Sil</button>}
              </div>
            </div>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-panel rounded-2xl border border-border/60 p-5 h-fit flex flex-col gap-3">
        <h2 className="font-semibold text-[15px]">{form.id ? 'Rolu / şifrəni dəyiş' : 'Yeni işçi'}</h2>
        <div>
          <label className="text-[12px] font-semibold text-muted mb-1 block">E-poçt</label>
          <input required type="email" disabled={!!form.id} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={`${inputCls} disabled:opacity-60`} />
        </div>
        <div>
          <label className="text-[12px] font-semibold text-muted mb-1 block">{form.id ? 'Yeni şifrə (boş = dəyişmə)' : 'Şifrə (min 8)'}</label>
          <input required={!form.id} type="password" minLength={form.id && !form.password ? 0 : 8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className={inputCls} />
        </div>
        <div>
          <label className="text-[12px] font-semibold text-muted mb-1 block">Rol</label>
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className={inputCls}>
            {ROLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div className="flex gap-2">
          <Button type="submit" disabled={saving} className="flex-1">{saving ? 'Saxlanılır...' : 'Saxla'}</Button>
          {form.id && <Button type="button" variant="outline" onClick={() => setForm(emptyForm)}>Ləğv et</Button>}
        </div>
      </form>
    </div>
  )
}

export default StaffAdmin
