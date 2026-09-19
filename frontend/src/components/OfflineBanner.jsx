import { useEffect, useState } from 'react'
import { useMenuStore } from '../store/menuStore'
import { useOutboxStore } from '../store/outboxStore'
import { useUiStore } from '../store/uiStore'
import { useT } from '../lib/i18n'

// İnternet kəsiləndə xəbərdarlıq göstərir; bərpa olunanda menyunu sinxronlaşdırır və offline növbədəki sifarişləri göndərir.
function OfflineBanner() {
  const t = useT()
  const [online, setOnline] = useState(navigator.onLine)
  const pending = useOutboxStore((s) => s.items.filter((i) => i.status === 'pending').length)

  useEffect(() => {
    const sendQueued = async () => {
      const sent = await useOutboxStore.getState().flush()
      if (sent.length) useUiStore.getState().showToast(t('outbox_sent'))
    }
    const goOnline = () => {
      setOnline(true)
      useMenuStore.getState().fetchAll()
      sendQueued()
    }
    if (navigator.onLine) sendQueued() // tətbiq açılanda əvvəlki sessiyadan qalan növbə
    const goOffline = () => setOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  if (online) return null
  return (
    <div className="sticky top-0 z-50 bg-ink text-cream text-center text-[12px] font-semibold py-2 px-4">
      {t('offline_banner')}{pending > 0 && ` · ${pending} ${t('outbox_pending').toLowerCase()}`}
    </div>
  )
}

export default OfflineBanner
