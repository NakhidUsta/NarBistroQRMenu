import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import Button from '../components/Button'

function Login() {
  const navigate = useNavigate()
  const login = useAuthStore((s) => s.login)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      await login(email, password)
      navigate('/admin/dashboard')
    } catch (err) {
      setError(err.response?.data?.error || 'Giriş uğursuz oldu')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-ink px-5">
      <form onSubmit={handleSubmit} className="w-full max-w-sm bg-panel rounded-2xl p-7 shadow-2xl">
        <h1 className="font-display text-[22px] font-semibold text-ink mb-1">Admin panel</h1>
        <p className="text-[13px] text-muted mb-6">QR Menu idarəetmə mərkəzi</p>

        <div className="mb-3">
          <label className="text-[12.5px] font-semibold text-muted mb-1 block">E-poçt</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-cream border border-border rounded-xl px-4 py-3 text-[14px] focus:outline-none focus:ring-2 focus:ring-burgundy/30"
          />
        </div>
        <div className="mb-5">
          <label className="text-[12.5px] font-semibold text-muted mb-1 block">Şifrə</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-cream border border-border rounded-xl px-4 py-3 text-[14px] focus:outline-none focus:ring-2 focus:ring-burgundy/30"
          />
        </div>

        {error && <p className="text-[13px] text-danger mb-4">{error}</p>}

        <Button type="submit" disabled={submitting} className="w-full">
          {submitting ? 'Yoxlanılır...' : 'Daxil ol'}
        </Button>
      </form>
    </div>
  )
}

export default Login
