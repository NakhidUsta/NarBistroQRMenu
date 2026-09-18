import { useEffect, useState } from 'react'
import { useMenuStore } from '../store/menuStore'
import { useT } from '../lib/i18n'

// İnternet kəsiləndə xəbərdarlıq göstərir; bərpa olunanda menyunu avtomatik sinxronlaşdırır.
function OfflineBanner() {
  const t = useT()
  const [online, setOnline] = useState(navigator.onLine)

  useEffect(() => {
    const goOnline = () => {
      setOnline(true)
      useMenuStore.getState().fetchAll()
    }
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
      {t('offline_banner')}
    </div>
  )
}

export default OfflineBanner
