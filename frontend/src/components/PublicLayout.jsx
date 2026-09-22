import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { useMenuStore } from '../store/menuStore'
import { useRestaurantStore } from '../store/restaurantStore'
import { useTableSessionStore } from '../store/tableSessionStore'
import { publicSocket } from '../lib/socket'
import { bindPublicSocket } from '../lib/socketBindings'
import { useT, useLocalize } from '../lib/i18n'
import { tableText } from '../lib/tableLabel'
import Toast from './Toast'
import TableActions from './TableActions'
import LanguageSwitcher from './LanguageSwitcher'
import BottomNav from './BottomNav'
import SiteHeader from './SiteHeader'
import BrandLogo from './BrandLogo'
import OfflineBanner from './OfflineBanner'
import ReviewsSection from './ReviewsSection'
import { applyTheme, resetTheme, parseTheme, applyFavicon } from '../lib/theme'
import { saveBrand } from '../lib/splash'
import { imageVariants, resolveUploadUrl } from '../lib/api'
import ResponsiveImage from './ResponsiveImage'
import ShareButton from './ShareButton'

// Telefon: dar sütun + alt naviqasiya. Kompüter (md+): tam en, sabit yuxarı başlıq (naviqasiya orada), geniş məzmun sahəsi.
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

  // Səhifə dəyişəndə (məsələn menyudan məhsula keçəndə) yuxarıdan başlasın — əvvəlki səhifənin sürüşdürmə yeri qalmasın
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [location.pathname])

  const theme = parseTheme(restaurant?.theme)

  useEffect(() => {
    applyFavicon(restaurant?.favicon_url ? resolveUploadUrl(imageVariants(restaurant.favicon_url)?.thumb || restaurant.favicon_url) : null)
  }, [restaurant?.favicon_url])

  useEffect(() => {
    applyTheme(restaurant?.theme)
  }, [restaurant?.theme])

  // Açılış ekranı (intro) növbəti girişdə restoranın adı/loqosu/rəngləri ilə dərhal göstərilsin deyə yadda saxlanılır
  useEffect(() => {
    if (restaurant) saveBrand(restaurant, theme)
  }, [restaurant])

  useEffect(() => () => resetTheme(), [])

  useEffect(() => {
    const name = localize(restaurant, 'name')
    if (name) document.title = `${name} — Menu`
  }, [restaurant, localize])

  const name = localize(restaurant, 'name') || 'QR Menu'

  return (
    <div className="min-h-screen bg-cream text-ink font-body">
      <SiteHeader />
      <div className="max-w-lg md:max-w-6xl mx-auto relative min-h-screen bg-cream pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0 sm:shadow-[0_0_60px_-30px_rgba(32,26,22,0.4)] md:shadow-none">
        <OfflineBanner />
        {!isSubPage && (
          <header className="md:hidden px-5 pt-6 pb-2 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted font-semibold truncate">
                {table ? tableText(t, table) : t('welcome')}
              </p>
              <h1 className="font-display text-[26px] font-semibold text-ink truncate">{name}</h1>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <LanguageSwitcher />
              <BrandLogo url={restaurant?.logo_url} name={name} />
            </div>
          </header>
        )}
        {!isSubPage && theme.hero_image_url && (
          <div className="px-5 md:px-8 mb-4 md:mt-6 md:mb-6">
            <div className="relative rounded-3xl overflow-hidden h-40 md:h-72 lg:h-80">
              <ResponsiveImage src={theme.hero_image_url} alt="" sizes="(min-width: 1152px) 1152px, 100vw" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-ink/75 via-ink/15 to-transparent" />
              <div className="absolute bottom-4 left-5 right-5 md:bottom-8 md:left-10 md:right-10 text-cream">
                {theme.hero_title && <p className="font-display text-[22px] md:text-[40px] font-semibold leading-tight">{theme.hero_title}</p>}
                {theme.hero_subtitle && <p className="text-[12.5px] md:text-[16px] opacity-90 mt-0.5 md:mt-2 md:max-w-xl">{theme.hero_subtitle}</p>}
              </div>
            </div>
          </div>
        )}
        {!isSubPage && theme.banner_text && (
          <div className="mx-5 md:mx-8 mb-4 bg-gold/20 border border-gold/40 rounded-xl px-4 py-2.5 text-center text-[12.5px] md:text-[14px] font-semibold text-ink">
            {theme.banner_text}
          </div>
        )}
        {!isSubPage && <TableActions />}
        <main>
          <Outlet />
        </main>
        {!isSubPage && <ReviewsSection />}
        {!isSubPage && restaurant && (
          <footer className="px-5 pt-8 pb-8 md:pb-12 text-center text-[12px] md:text-[13px] text-muted">
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
      </div>
      <BottomNav />
      <Toast />
    </div>
  )
}

export default PublicLayout
