import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { authApi } from '../lib/api'
import Button from '../components/Button'
import { inputCls } from './ForgotPassword'

function ResetPassword() {
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const [password, setPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (password !== repeat) {
      setError('Şifrələr uyğun gəlmir')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      await authApi.resetPassword(token, password)
      setDone(true)
    } catch (err) {
      setError(err.response?.data?.error || 'Şifrə dəyişmədi, bir az sonra yenidən cəhd edin')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-ink px-5">
      <div className="w-full max-w-sm bg-panel rounded-2xl p-7 shadow-2xl">
        <h1 className="font-display text-[22px] font-semibold text-ink mb-1">Yeni şifrə</h1>

        {!token ? (
          <>
            <p role="alert" className="text-[13.5px] text-danger my-5">Link yarımçıqdır — e-poçtdakı linkə tam basın və ya yenisini tələb edin.</p>
            <Link to="/admin/forgot-password" className="block text-center text-[13px] font-semibold text-burgundy">Yeni link tələb et</Link>
          </>
        ) : done ? (
          <>
            <div role="status" className="bg-success/10 border border-success/30 rounded-xl px-4 py-3.5 text-[13.5px] text-ink my-5">
              Şifrə dəyişdirildi. Təhlükəsizlik üçün bütün cihazlardan çıxış edildi.
            </div>
            <Link to="/admin/login" className="block text-center bg-btn text-cream rounded-full px-6 py-3 text-[14px] font-semibold">Daxil ol</Link>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <p className="text-[13px] text-muted mb-5">Ən azı 8 simvoldan ibarət yeni şifrə təyin edin.</p>
            <label htmlFor="new-password" className="text-[12.5px] font-semibold text-muted mb-1 block">Yeni şifrə</label>
            <input id="new-password" type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className={`${inputCls} mb-3`} />
            <label htmlFor="repeat-password" className="text-[12.5px] font-semibold text-muted mb-1 block">Yeni şifrə (təkrar)</label>
            <input id="repeat-password" type="password" required minLength={8} autoComplete="new-password" value={repeat} onChange={(e) => setRepeat(e.target.value)} className={`${inputCls} mb-4`} />
            {error && (
              <p role="alert" className="text-[13px] text-danger mb-4">
                {error} {/etibarsız|vaxtı/i.test(error) && <Link to="/admin/forgot-password" className="font-semibold underline">Yeni link tələb et</Link>}
              </p>
            )}
            <Button type="submit" disabled={submitting} className="w-full">{submitting ? 'Saxlanılır...' : 'Şifrəni dəyiş'}</Button>
          </form>
        )}
      </div>
    </div>
  )
}

export default ResetPassword
