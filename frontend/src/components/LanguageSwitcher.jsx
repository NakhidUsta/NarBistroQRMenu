import { useLocaleStore } from '../store/localeStore'
import { LOCALES } from '../lib/i18n'

function LanguageSwitcher() {
  const locale = useLocaleStore((s) => s.locale)
  const setLocale = useLocaleStore((s) => s.setLocale)

  return (
    <div className="flex bg-panel border border-border rounded-full p-0.5 shrink-0">
      {LOCALES.map((l) => (
        <button
          key={l.code}
          type="button"
          onClick={() => setLocale(l.code)}
          className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-colors ${
            locale === l.code ? 'bg-ink text-cream' : 'text-muted'
          }`}
        >
          {l.label}
        </button>
      ))}
    </div>
  )
}

export default LanguageSwitcher
