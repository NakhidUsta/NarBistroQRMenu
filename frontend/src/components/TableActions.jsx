import { useState } from 'react'
import { useTableSessionStore } from '../store/tableSessionStore'
import { useUiStore } from '../store/uiStore'
import { tablesApi } from '../lib/api'
import { useT } from '../lib/i18n'

function TableActions() {
  const table = useTableSessionStore((s) => s.table)
  const showToast = useUiStore((s) => s.showToast)
  const t = useT()
  const [busy, setBusy] = useState(null)

  if (!table) return null

  async function trigger(kind, action, successMessage) {
    setBusy(kind)
    try {
      await action(table.code)
      showToast(successMessage)
    } catch {
      showToast(t('request_failed'), 'error')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex gap-2 px-5 md:px-8 mb-4 md:max-w-xl">
      <button
        type="button"
        disabled={busy === 'waiter'}
        onClick={() => trigger('waiter', tablesApi.callWaiter, t('call_waiter_sent'))}
        className="flex-1 flex items-center justify-center gap-1.5 border border-border bg-panel rounded-full py-2.5 text-[12.5px] font-semibold text-ink hover:bg-blush disabled:opacity-50"
      >
        🔔 {t('call_waiter')}
      </button>
      <button
        type="button"
        disabled={busy === 'bill'}
        onClick={() => trigger('bill', tablesApi.requestBill, t('request_bill_sent'))}
        className="flex-1 flex items-center justify-center gap-1.5 border border-border bg-panel rounded-full py-2.5 text-[12.5px] font-semibold text-ink hover:bg-blush disabled:opacity-50"
      >
        🧾 {t('request_bill')}
      </button>
    </div>
  )
}

export default TableActions
