import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { authApi } from '../lib/api'
import Button from '../components/Button'

export const inputCls = 'w-full bg-cream border border-border rounded-xl px-4 py-3 text-[14px] focus:outline-none focus:ring-2 focus:ring-burgundy/30'

function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState('')
  const [error, setError] = useState('')
  // e-poçt xidməti (Gmail SMTP) qurulubmu: null = hələ yoxlanılır, false = qurulmayıb
  const [available, setAvailable] = useState(null)

  useEffect(() => {
    authApi.config().then((c) => setAvailable(!!c.password_reset)).catch(() => setAvailable(null))
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const { message } = await authApi.forgotPassword(email.trim())
      setDone(message)
    } catch (err) {
      setError(err.response?.data?.error || 'Sorğu göndərilmədi, bir az sonra yenidən cəhd edin')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-ink px-5">
      <div className="w-full max-w-sm bg-panel rounded-2xl p-7 shadow-2xl">
        <h1 className="font-display text-[22px] font-semibold text-ink mb-1">Şifrəni unutdunuz?</h1>
        <p className="text-[13px] text-muted mb-6">E-poçt ünvanınızı yazın — şifrəni sıfırlamaq üçün link göndərək.</p>

        {available === false && !done && (
          <div role="note" data-testid="mail-unavailable" className="bg-gold/15 border border-gold/40 rounded-xl px-4 py-3.5 text-[13px] text-ink mb-5">
            <p className="font-semibold mb-1">E-poçt xidməti hələ qurulmayıb</p>
            <p className="text-muted">Şifrəni e-poçtla sıfırlamaq üçün sistem administratoru Gmail (SMTP) ayarlarını qurmalıdır. O vaxta qədər şifrəni server administratoru sıfırlaya bilər.</p>
          </div>
        )}

        {done ? (
          <div role="status" className="bg-success/10 border border-success/30 rounded-xl px-4 py-3.5 text-[13.5px] text-ink mb-5">{done}</div>
        ) : (
          <form onSubmit={handleSubmit}>
            <label htmlFor="forgot-email" className="text-[12.5px] font-semibold text-muted mb-1 block">E-poçt</label>
            <input id="forgot-email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={`${inputCls} mb-4`} />
            {error && <p role="alert" className="text-[13px] text-danger mb-4">{error}</p>}
            <Button type="submit" disabled={submitting || available === false} className="w-full">{submitting ? 'Göndərilir...' : 'Sıfırlama linki göndər'}</Button>
          </form>
        )}

        <Link to="/admin/login" className="block text-center text-[13px] font-semibold text-burgundy mt-5">← Girişə qayıt</Link>
      </div>
    </div>
  )
}

export default ForgotPassword
