import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { paymentsApi } from '../lib/api'
import Button from '../components/Button'

// Sınaq ödəniş səhifəsi (PAYMENT_PROVIDER=test): real kart/pul yoxdur. Yalnız inkişaf və demo üçündür —
// production-da backend bu əməliyyatı rədd edir (404).
function TestPay() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const o = params.get('o')
  const sig = params.get('sig')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function complete(outcome) {
    setBusy(true)
    setError('')
    try {
      const res = await paymentsApi.testComplete({ o, sig, outcome })
      navigate(`/order/${res.order_id}?token=${res.access_token}&pay=${outcome === 'success' ? 'success' : 'error'}`, { replace: true })
    } catch (err) {
      setError(err.response?.data?.error || 'Sınaq ödənişi tamamlana bilmədi')
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center p-5">
      <div className="bg-panel rounded-3xl border border-border/60 shadow-xl w-full max-w-sm p-6 text-center" data-testid="test-pay">
        <p className="inline-block bg-gold/30 text-ink text-[11px] font-bold uppercase tracking-wider rounded-full px-3 py-1 mb-3">Sınaq rejimi</p>
        <h1 className="font-display text-[22px] font-semibold mb-1">Onlayn ödəniş</h1>
        <p className="text-[13px] text-muted mb-5">Bu, saxta ödəniş səhifəsidir — real pul çıxmır. Real provayder (Epoint) qoşulanda burada bankın kart səhifəsi açılacaq.</p>
        {!o || !sig ? (
          <p className="text-danger text-[13px] font-semibold">Ödəniş linki yanlışdır</p>
        ) : (
          <div className="flex flex-col gap-2.5">
            <Button variant="accent" onClick={() => complete('success')} disabled={busy}>✓ Uğurlu ödə</Button>
            <Button variant="outline" onClick={() => complete('failed')} disabled={busy}>✕ Ödənişi rədd et</Button>
          </div>
        )}
        {error && <p className="text-danger text-[12.5px] font-semibold mt-3">{error}</p>}
      </div>
    </div>
  )
}

export default TestPay
