import { useEffect, useRef, useState } from 'react'
import { paymentsApi } from '../lib/api'
import { useOrderStore } from '../store/orderStore'
import { useLocaleStore } from '../store/localeStore'
import { useUiStore } from '../store/uiStore'
import { useT } from '../lib/i18n'
import Button from './Button'

const POLL_MS = 3000
const POLL_MAX = 10 // ~30 san: callback gecikirsə statusu bir neçə dəfə yoxlayırıq

// Sifariş səhifəsində ödəniş vəziyyəti. `returned` — ödəniş səhifəsindən qayıdılıb (?pay=success|error). Bu parametr YALNIZ
// "yoxla" siqnalıdır: ödənişin uğurlu olub-olmadığını həmişə serverdəki payment_status deyir (URL saxtalaşdırıla bilər).
function PaymentPanel({ order, token, returned }) {
  const t = useT()
  const locale = useLocaleStore((s) => s.locale)
  const showToast = useUiStore((s) => s.showToast)
  const updateOrder = useOrderStore((s) => s.updateOrder)
  const [busy, setBusy] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const polls = useRef(0)

  const awaiting = order.payment_method === 'ONLINE' && ['PENDING', 'FAILED'].includes(order.payment_status)
  const cancelled = order.status === 'CANCELLED'

  // Ödəniş səhifəsindən qayıdanda: serverdən təsdiq soruş, gecikirsə bir neçə dəfə təkrarla
  useEffect(() => {
    if (!returned || !awaiting || cancelled) return undefined
    let stop = false
    let timer
    setVerifying(true)
    const check = async () => {
      try {
        const fresh = await paymentsApi.verify(order.id, token)
        if (stop) return
        updateOrder(fresh)
        if (fresh.payment_status === 'PENDING' && polls.current < POLL_MAX) {
          polls.current += 1
          timer = setTimeout(check, POLL_MS)
          return
        }
      } catch {
        // şəbəkə xətası — socket yeniləməsi də gələ bilər
      }
      if (!stop) setVerifying(false)
    }
    check()
    return () => {
      stop = true
      clearTimeout(timer)
    }
  }, [returned, order.id, token])

  useEffect(() => {
    if (order.payment_status === 'PAID') setVerifying(false)
  }, [order.payment_status])

  async function pay() {
    setBusy(true)
    try {
      const { redirect_url: url } = await paymentsApi.start(order.id, token, locale)
      window.location.assign(url)
    } catch (err) {
      showToast(err.response?.data?.error || t('pay_start_failed'), 'error')
      setBusy(false)
    }
  }

  const box = 'rounded-2xl border px-5 py-4 mb-6'
  const method = { CASH: t('pay_cash'), CARD_POS: t('pay_card_pos'), ONLINE: t('pay_online') }[order.payment_method]

  if (order.payment_status === 'PAID') {
    return (
      <div className={`${box} bg-success/10 border-success/30`} data-testid="payment-panel" data-state="paid">
        <p className="font-semibold text-success text-[14px]">✓ {t('pay_status_paid')} · {method}</p>
        {returned && <p className="text-[13px] text-ink mt-1">{t('pay_success_msg')}</p>}
        {order.paid_at && <p className="text-[12px] text-muted mt-0.5">{new Date(order.paid_at).toLocaleString('az-AZ')}</p>}
      </div>
    )
  }
  if (order.payment_status === 'REFUNDED') {
    return <div className={`${box} bg-blush border-border`} data-testid="payment-panel" data-state="refunded"><p className="font-semibold text-[14px]">{t('pay_status_refunded')}</p></div>
  }
  if (!awaiting) {
    // nağd / kartla masada: təhvil zamanı ödənir
    return (
      <div className={`${box} bg-panel border-border/60`} data-testid="payment-panel" data-state="unpaid">
        <p className="text-[12px] uppercase tracking-wider font-bold text-muted mb-1">{t('pay_title')}</p>
        <p className="text-[14px] font-semibold">{method}</p>
        <p className="text-[12.5px] text-muted">{t('pay_status_unpaid')}</p>
      </div>
    )
  }
  if (cancelled) {
    return <div className={`${box} bg-danger/10 border-danger/20`} data-testid="payment-panel" data-state="expired"><p className="text-[13px] text-danger font-semibold">{t('pay_expired_msg')}</p></div>
  }

  const failed = order.payment_status === 'FAILED' || (returned === 'error' && !verifying)
  return (
    <div className={`${box} ${failed ? 'bg-danger/10 border-danger/25' : 'bg-gold/15 border-gold/40'}`} data-testid="payment-panel" data-state={verifying ? 'verifying' : failed ? 'failed' : 'pending'}>
      <p className={`font-semibold text-[14px] ${failed ? 'text-danger' : 'text-ink'}`}>
        {verifying ? t('pay_verifying') : failed ? t('pay_status_failed') : t('pay_status_pending')}
      </p>
      <p className="text-[12.5px] text-muted mt-1 mb-3">{failed && !verifying ? t('pay_failed_msg') : t('pay_pending_msg')}</p>
      {!verifying && (
        <>
          <Button variant="accent" className="w-full" onClick={pay} disabled={busy}>
            {busy ? t('sending') : failed ? t('pay_retry') : t('pay_now')}
          </Button>
          <p className="text-[11.5px] text-muted mt-2 text-center">🔒 {t('pay_secure_note')}</p>
        </>
      )}
    </div>
  )
}

export default PaymentPanel
