import { useCallback, useEffect, useState } from 'react'
import { mailSettingsApi } from '../lib/api'
import { useUiStore } from '../store/uiStore'
import Button from '../components/Button'

const inputCls = 'w-full bg-cream border border-border rounded-lg px-3 py-2.5 text-[13.5px] focus:outline-none focus:ring-2 focus:ring-burgundy/30'

// Gmail qoşulması (şifrəni unutdum məktubları): .env faylını redaktə etmədən, paneldən. Yalnız OWNER.
// Gmail girişi saxlanmazdan əvvəl HƏQİQƏTƏN yoxlanılır; App Password bazada şifrələnir və heç vaxt geri göstərilmir.
function MailSettings() {
  const showToast = useUiStore((s) => s.showToast)
  const [status, setStatus] = useState(null)
  const [form, setForm] = useState({ smtp_user: '', smtp_pass: '' })
  const [busy, setBusy] = useState('')

  const load = useCallback(() => mailSettingsApi.get().then(setStatus).catch(() => setStatus({ configured: false, source: null })), [])
  useEffect(() => {
    load()
  }, [load])

  async function run(kind, action, fallback) {
    setBusy(kind)
    try {
      const res = await action()
      if (res?.message) showToast(res.message)
      return res
    } catch (err) {
      showToast(err.response?.data?.error || fallback, 'error')
      return null
    } finally {
      setBusy('')
    }
  }

  async function save(e) {
    e.preventDefault()
    const res = await run('save', () => mailSettingsApi.save(form), 'Gmail qoşulmadı')
    if (res) {
      setForm({ smtp_user: '', smtp_pass: '' })
      setStatus(res)
    }
  }

  async function remove() {
    if (!confirm('Gmail bağlantısı silinsin? Şifrəni unutdum məktubları göndərilməyəcək.')) return
    const res = await run('remove', () => mailSettingsApi.remove(), 'Silinmədi')
    if (res) {
      setStatus(res)
      showToast('Gmail bağlantısı silindi')
    }
  }

  const sourceText = { panel: 'paneldən qoşulub', env: '.env faylından', console: 'sınaq rejimi (məktub göndərilmir, konsola yazılır)' }[status?.source]

  return (
    <section className="bg-panel rounded-2xl border border-border/60 p-6 mt-6 max-w-xl" data-testid="mail-settings" aria-labelledby="mail-heading">
      <h2 id="mail-heading" className="font-semibold text-[15px] mb-1">E-poçt (Gmail) — şifrəni unutdum məktubları</h2>
      <p className="text-[12.5px] text-muted mb-4">İşçi girişdə "Şifrəni unutdunuz?" basanda öz e-poçtuna şifrəni dəyişmək üçün link gedir. Məktublar buradakı Gmail hesabından göndərilir.</p>

      <div className={`rounded-xl px-4 py-3 mb-4 text-[13px] ${status?.configured ? 'bg-success/10 border border-success/30' : 'bg-gold/15 border border-gold/40'}`} role="status" data-testid="mail-status">
        {status === null ? 'Yoxlanılır…' : status.configured ? (
          <>
            <span className="font-semibold text-success">✓ Qoşulub</span>
            {status.smtp_user && <span> · {status.smtp_user}</span>}
            {sourceText && <span className="text-muted"> ({sourceText})</span>}
          </>
        ) : (
          <span className="font-semibold">Qoşulmayıb — aşağıda Gmail ünvanını və App Password-u yazın</span>
        )}
      </div>

      <details className="mb-4 text-[12.5px] bg-cream rounded-xl px-4 py-3">
        <summary className="font-semibold cursor-pointer">App Password necə yaradılır? (bir dəfəlik, 2 dəqiqə)</summary>
        <ol className="list-decimal pl-5 mt-2 space-y-1 text-ink/90">
          <li>Google hesabınızda <b>2 addımlı doğrulamanı</b> açın (Təhlükəsizlik bölməsi).</li>
          <li><a className="text-burgundy underline font-semibold" href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer">myaccount.google.com/apppasswords</a> səhifəsini açın.</li>
          <li>Ad yazın (məs. <i>QR Menu</i>) və <b>Yarat</b> basın — 16 simvollu şifrə çıxacaq.</li>
          <li>Həmin şifrəni aşağıdakı "App Password" xanasına yapışdırın (boşluqlar problem deyil). Adi Gmail şifrəsi işləmir.</li>
        </ol>
      </details>

      <form onSubmit={save} className="flex flex-col gap-3">
        <div>
          <label htmlFor="smtp-user" className="text-[12px] font-semibold text-muted mb-1 block">Gmail ünvanı</label>
          <input id="smtp-user" required type="email" autoComplete="off" value={form.smtp_user} onChange={(e) => setForm({ ...form, smtp_user: e.target.value })} className={inputCls} placeholder="restoran@gmail.com" />
        </div>
        <div>
          <label htmlFor="smtp-pass" className="text-[12px] font-semibold text-muted mb-1 block">App Password (16 simvol)</label>
          <input id="smtp-pass" required type="password" autoComplete="new-password" value={form.smtp_pass} onChange={(e) => setForm({ ...form, smtp_pass: e.target.value })} className={inputCls} placeholder={status?.configured ? '•••• •••• •••• ••••  (yeni yazsanız əvəz olunur)' : 'abcd efgh ijkl mnop'} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={busy === 'save'}>{busy === 'save' ? 'Gmail-ə qoşulur…' : 'Yoxla və saxla'}</Button>
          {status?.configured && status?.source !== 'console' && (
            <Button type="button" variant="outline" disabled={busy === 'test'} onClick={() => run('test', () => mailSettingsApi.test(), 'Sınaq məktubu göndərilmədi')}>
              {busy === 'test' ? 'Göndərilir…' : 'Sınaq məktubu göndər'}
            </Button>
          )}
          {status?.source === 'panel' && (
            <Button type="button" variant="outline" disabled={busy === 'remove'} onClick={remove}>Bağlantını sil</Button>
          )}
        </div>
        <p className="text-[11.5px] text-muted">Şifrə bazada şifrələnmiş saxlanılır və bir daha göstərilmir. Saxlayanda sistem Gmail-ə həqiqətən daxil olmağa çalışır — yanlışdırsa saxlanmır.</p>
      </form>
    </section>
  )
}

export default MailSettings
