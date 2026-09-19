import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { useMenuStore } from '../store/menuStore'
import { useRestaurantStore } from '../store/restaurantStore'
import { useTableSessionStore } from '../store/tableSessionStore'
import { publicSocket } from '../lib/socket'
import { bindPublicSocket } from '../lib/socketBindings'
import { useT, useLocalize } from '../lib/i18n'
import Toast from './Toast'
import TableActions from './TableActions'
import LanguageSwitcher from './LanguageSwitcher'
import BottomNav from './BottomNav'
import OfflineBanner from './OfflineBanner'
import ReviewsSection from './ReviewsSection'
import { applyTheme, resetTheme, parseTheme, applyFavicon } from '../lib/theme'
import { imageVariants, resolveUploadUrl } from '../lib/api'
import ResponsiveImage from './ResponsiveImage'
import ShareButton from './ShareButton'

function PublicLayout() {
  const location = useLocation()
  const fetchMenu = useMenuStore((s) => s.fetchAll)
  const fetchRestaurant = useRestaurantStore((s) => s.fetch)
  const restaurant = useRestaurantStore((s) => s.restaurant)
  const table = useTableSessionStore((s) => s.table)
  const t = useT()
  const localize = useLocalize()

  useEffect(() => {
    fetchRestaurant()
    fetchMenu()
    bindPublicSocket()
    if (!publicSocket.connected) {
      if (table?.code) {
        publicSocket.io.opts.query = { table: table.code }
      }
      publicSocket.connect()
    }
  }, [])

  const isSubPage = location.pathname !== '/menyu' && location.pathname !== '/'

  const theme = parseTheme(restaurant?.theme)

  useEffect(() => {
    applyFavicon(restaurant?.favicon_url ? resolveUploadUrl(imageVariants(restaurant.favicon_url)?.thumb || restaurant.favicon_url) : null)
  }, [restaurant?.favicon_url])

  useEffect(() => {
    applyTheme(restaurant?.theme)
  }, [restaurant?.theme])

  useEffect(() => () => resetTheme(), [])

  useEffect(() => {
    const name = localize(restaurant, 'name')
    if (name) document.title = `${name} — Menu`
  }, [restaurant, localize])

  return (
    <div className="min-h-screen bg-cream text-ink font-body">
     <div className="max-w-lg mx-auto relative min-h-screen bg-cream sm:shadow-[0_0_60px_-30px_rgba(32,26,22,0.4)]">
      <OfflineBanner />
      {!isSubPage && (
        <header className="px-5 pt-6 pb-2 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted font-semibold truncate">
              {table ? `${t('table_label')} — ${table.label}` : t('welcome')}
            </p>
            <h1 className="font-display text-[26px] font-semibold text-ink truncate">
              {localize(restaurant, 'name') || 'QR Menu'}
            </h1>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <LanguageSwitcher />
            {restaurant?.logo_url && (
              <img src={restaurant.logo_url} alt="" className="w-11 h-11 rounded-full object-cover border-2 border-border" />
            )}
          </div>
        </header>
      )}
      {!isSubPage && theme.hero_image_url && (
        <div className="px-5 mb-4">
          <div className="relative rounded-3xl overflow-hidden h-40">
            <ResponsiveImage src={theme.hero_image_url} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-ink/75 via-ink/15 to-transparent" />
            <div className="absolute bottom-4 left-5 right-5 text-cream">
              {theme.hero_title && <p className="font-display text-[22px] font-semibold leading-tight">{theme.hero_title}</p>}
              {theme.hero_subtitle && <p className="text-[12.5px] opacity-90 mt-0.5">{theme.hero_subtitle}</p>}
            </div>
          </div>
        </div>
      )}
      {!isSubPage && theme.banner_text && (
        <div className="mx-5 mb-4 bg-gold/20 border border-gold/40 rounded-xl px-4 py-2.5 text-center text-[12.5px] font-semibold text-ink">
          {theme.banner_text}
        </div>
      )}
      {!isSubPage && <TableActions />}
      <Outlet />
      {!isSubPage && <ReviewsSection />}
      {!isSubPage && restaurant && (
        <footer className="px-5 pt-8 pb-28 text-center text-[12px] text-muted">
          {theme.footer_text && <p className="text-[13px] text-ink/80 mb-2">{theme.footer_text}</p>}
          {restaurant.address && <p>{restaurant.address}</p>}
          {restaurant.working_hours && <p>{restaurant.working_hours}</p>}
          <p className="mt-1 flex justify-center gap-3 flex-wrap font-semibold text-burgundy">
            {restaurant.phone && <a href={`tel:${restaurant.phone}`}>{restaurant.phone}</a>}
            {restaurant.whatsapp && <a href={`https://wa.me/${restaurant.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer">WhatsApp</a>}
            {restaurant.instagram_link && <a href={restaurant.instagram_link} target="_blank" rel="noreferrer">Instagram</a>}
            {restaurant.facebook_link && <a href={restaurant.facebook_link} target="_blank" rel="noreferrer">Facebook</a>}
            {restaurant.tiktok_link && <a href={restaurant.tiktok_link} target="_blank" rel="noreferrer">TikTok</a>}
            {restaurant.google_maps_link && <a href={restaurant.google_maps_link} target="_blank" rel="noreferrer">Xəritə</a>}
          </p>
          <ShareButton path="/menyu" title={restaurant.name} text={restaurant.name} label className="mx-auto mt-3 px-4 py-2 rounded-full border border-border text-[12.5px] font-semibold text-burgundy" />
        </footer>
      )}
      <BottomNav />
      <Toast />
     </div>
    </div>
  )
}

export default PublicLayout
