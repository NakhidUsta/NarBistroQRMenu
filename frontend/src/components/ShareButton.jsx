import { shareLink, publicUrl } from '../lib/share'
import { useUiStore } from '../store/uiStore'
import { useT } from '../lib/i18n'

function ShareButton({ path, title, text, className = '', label = false }) {
  const t = useT()
  const showToast = useUiStore((s) => s.showToast)

  async function handle(e) {
    e.preventDefault()
    e.stopPropagation()
    const result = await shareLink({ title, text, url: publicUrl(path) })
    if (result === 'copied') showToast(t('share_link_copied'))
    else if (result === 'failed') showToast(t('share_failed'), 'error')
  }

  return (
    <button type="button" aria-label={t('share')} onClick={handle} className={`flex items-center justify-center gap-1.5 transition-transform active:scale-90 ${className}`}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M16 6l-4-4-4 4M12 2v13" />
      </svg>
      {label && <span>{t('share')}</span>}
    </button>
  )
}

export default ShareButton
