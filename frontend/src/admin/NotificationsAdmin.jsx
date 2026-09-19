import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useNotificationStore } from '../store/notificationStore'
import { useUiStore } from '../store/uiStore'
import { SOUND_TYPES, TONES, useSoundSettings } from '../lib/soundSettings'
import { browserNotify, notificationPermission, previewTone, requestNotificationPermission, unlockAudio, useAudioState } from '../lib/alerts'
import { FILTERS, HANDLEABLE, HandlePanel, TARGET, TYPE_ICON, matches, timeAgo } from './notificationParts'

const card = 'bg-panel border border-border rounded-2xl'

// Səs ayarları: ümumi açar, həcm, növ üzrə siqnal seçimi və sınaq
function SoundSettings({ role }) {
  const enabled = useSoundSettings((s) => s.enabled)
  const volume = useSoundSettings((s) => s.volume)
  const tones = useSoundSettings((s) => s.tones)
  const setEnabled = useSoundSettings((s) => s.setEnabled)
  const setVolume = useSoundSettings((s) => s.setVolume)
  const setTone = useSoundSettings((s) => s.setTone)
  const audio = useAudioState((s) => s.state)
  const showToast = useUiStore((s) => s.showToast)
  const [permission, setPermission] = useState(notificationPermission())

  // Ofisiant sistem xətası bildirişlərini görmür — onun səsini də ayarlamağın mənası yoxdur
  const types = Object.entries(SOUND_TYPES).filter(([type]) => !(role === 'WAITER' && type === 'system_error'))
  const blocked = enabled && (audio === 'suspended' || audio === 'idle')

  async function enableSound() {
    const ok = await unlockAudio()
    if (ok) {
      await previewTone('bell')
      showToast('Səs aktivləşdirildi', 'success')
    }
  }

  function askPermission() {
    requestNotificationPermission()
    // icazə cavabı asinxron gəlir — qısa gözləyib vəziyyəti yeniləyirik
    setTimeout(() => setPermission(notificationPermission()), 600)
    setTimeout(() => setPermission(notificationPermission()), 3000)
  }

  return (
    <section className={`${card} p-4 sm:p-5`} aria-labelledby="sound-heading" data-testid="sound-settings">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="sound-heading" className="font-display text-lg font-semibold">🔊 Bildiriş səsi</h2>
          <p className="text-[12px] text-muted mt-0.5">Yeni sifariş, çağırış və s. gələndə səs çalınır. Ayarlar yalnız bu cihazda saxlanılır.</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="Səsi aç/bağla"
          onClick={() => setEnabled(!enabled)}
          className={`relative w-11 h-6 rounded-full shrink-0 transition-colors ${enabled ? 'bg-burgundy' : 'bg-border'}`}
        >
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-5' : ''}`} />
        </button>
      </div>

      {audio === 'unsupported' && <p className="mt-3 text-[12px] text-danger">Bu brauzer səs çalmağı dəstəkləmir.</p>}
      {blocked && (
        <div className="mt-3 rounded-xl bg-gold/15 border border-gold/40 px-3 py-2.5 flex items-center justify-between gap-3" role="alert">
          <p className="text-[12px] text-ink">Brauzer səsi bloklayıb — bir dəfə aktivləşdirmək lazımdır.</p>
          <button type="button" onClick={enableSound} className="shrink-0 px-3 py-1.5 rounded-full bg-burgundy text-white text-[12px] font-bold">
            Səsi aktivləşdir
          </button>
        </div>
      )}

      <div className={`mt-4 ${enabled ? '' : 'opacity-50 pointer-events-none'}`} aria-disabled={!enabled}>
        <label className="flex items-center gap-3 text-[12.5px] font-semibold">
          <span className="w-16 shrink-0">Həcm</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={volume}
            onChange={(e) => setVolume(e.target.value)}
            aria-label="Səsin həcmi"
            className="flex-1 accent-burgundy"
          />
          <span className="w-9 text-right text-muted tabular-nums">{Math.round(volume * 100)}%</span>
        </label>

        <ul className="mt-4 flex flex-col gap-2">
          {types.map(([type, { label, tone }]) => {
            const current = tones[type] || tone
            return (
              <li key={type} className="flex items-center gap-2">
                <span className="text-base w-6 text-center" aria-hidden="true">{TYPE_ICON[type]}</span>
                <span className="flex-1 min-w-0 text-[12.5px] font-medium truncate">{label}</span>
                <select
                  value={current}
                  onChange={(e) => setTone(type, e.target.value)}
                  aria-label={`${label} siqnalı`}
                  className="bg-cream border border-border rounded-lg px-2 py-1.5 text-[12px]"
                >
                  {Object.entries(TONES).map(([key, t]) => (
                    <option key={key} value={key}>{t.label}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => previewTone(current)}
                  disabled={current === 'off'}
                  aria-label={`${label} siqnalını sına`}
                  className="w-8 h-8 rounded-full border border-border text-[12px] hover:bg-blush disabled:opacity-40"
                >
                  ▶
                </button>
              </li>
            )
          })}
        </ul>
      </div>

      <div className="mt-5 pt-4 border-t border-border flex items-center justify-between gap-3">
        <div>
          <p className="text-[12.5px] font-semibold">Brauzer bildirişləri</p>
          <p className="text-[11.5px] text-muted">Səhifə arxa fonda olanda da xəbər versin.</p>
        </div>
        {permission === 'granted' && (
          <button type="button" onClick={() => browserNotify('Bildiriş sınağı', 'Brauzer bildirişləri işləyir')} className="px-3 py-1.5 rounded-full border border-border text-[12px] font-semibold">
            Sına
          </button>
        )}
        {permission === 'default' && (
          <button type="button" onClick={askPermission} className="px-3 py-1.5 rounded-full bg-burgundy text-white text-[12px] font-bold">
            İcazə ver
          </button>
        )}
        {permission === 'denied' && <span className="text-[11.5px] text-danger text-right">Brauzerdə bloklanıb</span>}
        {permission === 'unsupported' && <span className="text-[11.5px] text-muted">Dəstəklənmir</span>}
      </div>
    </section>
  )
}

function NotificationsAdmin() {
  const navigate = useNavigate()
  const role = useAuthStore((s) => s.admin?.role)
  const items = useNotificationStore((s) => s.items)
  const hasMore = useNotificationStore((s) => s.hasMore)
  const loadingMore = useNotificationStore((s) => s.loadingMore)
  const fetchAll = useNotificationStore((s) => s.fetchAll)
  const loadMore = useNotificationStore((s) => s.loadMore)
  const markRead = useNotificationStore((s) => s.markRead)
  const markAllRead = useNotificationStore((s) => s.markAllRead)
  const remove = useNotificationStore((s) => s.remove)
  const clearRead = useNotificationStore((s) => s.clearRead)
  const showToast = useUiStore((s) => s.showToast)
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)

  const unread = items.filter((n) => !n.isRead).length
  const pendingCalls = items.filter((n) => HANDLEABLE.includes(n.type) && n.status !== 'RESOLVED').length
  const visible = items.filter((n) => matches(n, filter))
  // Ofisiant üçün serverdə də süzülür — yenə də seçim siyahısını rola görə göstəririk
  const filters = FILTERS.filter(([v]) => !(role === 'WAITER' && v === 'system_error'))

  useEffect(() => {
    fetchAll()
      .catch(() => showToast('Bildirişlər yüklənmədi', 'error'))
      .finally(() => setLoading(false))
  }, [])

  async function run(action, message) {
    try {
      await action()
    } catch (err) {
      showToast(err.response?.data?.error || message, 'error')
    }
  }

  function open(n) {
    if (!n.isRead) run(() => markRead(n.id), 'Oxundu kimi işarələnmədi')
    const target = TARGET[n.entity_type]
    if (target && n.entity_id) navigate(target)
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
        <div>
          <h1 className="font-display text-2xl font-semibold">Bildirişlər</h1>
          <p className="text-[12.5px] text-muted mt-0.5" data-testid="notification-summary">
            {unread} oxunmamış{pendingCalls > 0 && <span className="text-danger font-semibold"> · {pendingCalls} gözləyən çağırış</span>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => document.getElementById('sound-settings')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            className="lg:hidden px-3.5 py-2 rounded-full border border-border text-[12.5px] font-semibold hover:bg-blush"
          >
            🔊 Səs ayarları
          </button>
          {unread > 0 && (
            <button type="button" onClick={() => run(markAllRead, 'Əməliyyat alınmadı')} className="px-3.5 py-2 rounded-full border border-border text-[12.5px] font-semibold hover:bg-blush">
              Hamısını oxu
            </button>
          )}
          <button type="button" onClick={() => run(clearRead, 'Silinmədi')} className="px-3.5 py-2 rounded-full border border-border text-[12.5px] font-semibold text-danger hover:bg-blush">
            Oxunmuşları sil
          </button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_360px] items-start">
        <section className={`${card} overflow-hidden`} aria-label="Bildiriş siyahısı">
          <div className="flex flex-wrap gap-1.5 px-4 py-3 border-b border-border">
            {filters.map(([v, l]) => (
              <button
                key={v}
                type="button"
                onClick={() => setFilter(v)}
                aria-pressed={filter === v}
                className={`px-3 py-1 rounded-full text-[11.5px] font-semibold border ${filter === v ? 'bg-ink text-cream border-ink' : 'text-muted border-border'}`}
              >
                {l}
              </button>
            ))}
          </div>

          {loading && <p className="text-[13px] text-muted px-4 py-10 text-center">Yüklənir…</p>}
          {!loading && visible.length === 0 && (
            <p className="text-[13px] text-muted px-4 py-10 text-center">{items.length ? 'Bu filtrə uyğun bildiriş yoxdur' : 'Hələ bildiriş yoxdur'}</p>
          )}

          <ul>
            {visible.map((n) => (
              <li key={n.id} className={`relative group border-b border-border/60 last:border-0 ${!n.isRead ? 'bg-gold/10' : ''}`} data-testid="notification-row">
                <button type="button" onClick={() => open(n)} className="w-full text-left px-4 pt-3.5 pb-2.5 pr-11 hover:bg-blush/40 flex gap-3">
                  <span className="text-lg leading-none mt-0.5" aria-hidden="true">{TYPE_ICON[n.type] || '🔔'}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[13.5px] font-semibold text-ink">{n.title}</span>
                    {n.body && <span className="block text-[12.5px] text-muted mt-0.5">{n.body}</span>}
                    <span className="block text-[11px] text-muted mt-1">{timeAgo(n.created_at)}</span>
                  </span>
                  {!n.isRead && <span className="w-2 h-2 rounded-full bg-burgundy mt-2 shrink-0" aria-label="Oxunmamış" />}
                </button>
                {HANDLEABLE.includes(n.type) && <HandlePanel n={n} className="px-4 pb-3.5 pl-[52px]" />}
                <button
                  type="button"
                  aria-label="Sil"
                  onClick={() => run(() => remove(n.id), 'Silinmədi')}
                  className="absolute top-2.5 right-3 w-7 h-7 rounded-full text-[12px] text-muted hover:text-danger hover:bg-white sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 transition-opacity"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>

          {hasMore && (
            <div className="p-3 border-t border-border text-center">
              <button
                type="button"
                onClick={() => run(loadMore, 'Növbəti səhifə yüklənmədi')}
                disabled={loadingMore}
                className="px-5 py-2 rounded-full border border-border text-[12.5px] font-semibold hover:bg-blush disabled:opacity-50"
              >
                {loadingMore ? 'Yüklənir…' : 'Daha köhnələri göstər'}
              </button>
            </div>
          )}
        </section>

        <div id="sound-settings" className="lg:sticky lg:top-20 scroll-mt-20">
          <SoundSettings role={role} />
        </div>
      </div>
    </div>
  )
}

export default NotificationsAdmin
