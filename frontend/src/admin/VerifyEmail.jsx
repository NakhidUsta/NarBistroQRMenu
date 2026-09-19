import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { authApi } from '../lib/api'
import { useAuthStore } from '../store/authStore'

// E-poçtdakı təsdiq linki bu səhifəni açır: token avtomatik göndərilir (yalnız bir dəfə — StrictMode-da təkrar sorğu tokeni "istifadə olunmuş" edərdi)
function VerifyEmail() {
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const [state, setState] = useState(token ? 'loading' : 'error')
  const [message, setMessage] = useState(token ? '' : 'Link yarımçıqdır — e-poçtdakı linkə tam basın.')
  const started = useRef(false)

  useEffect(() => {
    if (!token || started.current) return
    started.current = true
    authApi
      .verifyEmail(token)
      .then(() => {
        setState('ok')
        // eyni brauzerdə giriş edilibsə "təsdiqlənib" statusu dərhal yenilənsin
        useAuthStore.setState((s) => (s.admin ? { admin: { ...s.admin, email_verified: true } } : s))
      })
      .catch((err) => {
        setState('error')
        setMessage(err.response?.data?.error || 'Təsdiq alınmadı, bir az sonra yenidən cəhd edin')
      })
  }, [token])

  return (
    <div className="min-h-screen flex items-center justify-center bg-ink px-5">
      <div className="w-full max-w-sm bg-panel rounded-2xl p-7 shadow-2xl text-center">
        <h1 className="font-display text-[22px] font-semibold text-ink mb-4">E-poçtun təsdiqi</h1>
        {state === 'loading' && <p role="status" className="text-[13.5px] text-muted">Yoxlanılır...</p>}
        {state === 'ok' && (
          <div role="status" className="bg-success/10 border border-success/30 rounded-xl px-4 py-3.5 text-[13.5px] text-ink">✓ E-poçt ünvanınız təsdiqləndi.</div>
        )}
        {state === 'error' && <p role="alert" className="text-[13.5px] text-danger">{message}</p>}
        <Link to="/admin/login" className="block text-[13px] font-semibold text-burgundy mt-5">Admin panelə keç →</Link>
      </div>
    </div>
  )
}

export default VerifyEmail
