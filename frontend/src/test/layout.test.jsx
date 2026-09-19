import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import SiteHeader from '../components/SiteHeader'
import BrandLogo from '../components/BrandLogo'
import SplashGate from '../components/SplashGate'
import { hideSplash, saveBrand } from '../lib/splash'
import { useCartStore } from '../store/cartStore'
import { useMenuStore } from '../store/menuStore'
import { useRestaurantStore } from '../store/restaurantStore'
import { useTableSessionStore } from '../store/tableSessionStore'
import { useLocaleStore } from '../store/localeStore'

const wrap = (ui, path = '/menyu') => render(<MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>)

beforeEach(() => {
  useLocaleStore.setState({ locale: 'az' })
  useCartStore.setState({ items: [] })
  useMenuStore.setState({ products: [], categories: [], status: 'idle' })
  useTableSessionStore.setState({ table: { code: 'table_001', label: 'MASA 1' } })
  useRestaurantStore.setState({ restaurant: { name: 'By Orxan', logo_url: '' } })
})

describe('SiteHeader (kompüter başlığı)', () => {
  it('md+ ekranda görünür, telefonda gizlədilir; restoran adı, masa və 4 naviqasiya bəndi var', () => {
    wrap(<SiteHeader />)
    const header = screen.getByRole('banner')
    expect(header.className).toMatch(/hidden/)
    expect(header.className).toMatch(/md:block/)
    expect(header.className).toMatch(/sticky/)
    expect(screen.getByText('By Orxan')).toBeInTheDocument()
    const nav = screen.getByRole('navigation', { name: 'Əsas naviqasiya' })
    const hrefs = [...nav.querySelectorAll('a')].map((a) => a.getAttribute('href'))
    expect(hrefs).toEqual(['/menyu', '/favorites', '/orders', '/cart'])
  })

  it('səbət sayı nişanı göstərilir', () => {
    useCartStore.setState({ items: [{ product_id: 1, name: 'A', price: 5, quantity: 2 }, { product_id: 2, name: 'B', price: 5, quantity: 1 }] })
    wrap(<SiteHeader />)
    expect(screen.getByRole('link', { name: /Səbət/ })).toHaveTextContent('3')
  })
})

describe('BrandLogo', () => {
  it('şəkil yüklənməsə restoranın baş hərfi göstərilir (qırıq şəkil ikonu yox)', () => {
    const { container } = render(<BrandLogo url="/uploads/yoxdur.png" name="By Orxan" className="w-10 h-10" />)
    const img = container.querySelector('img')
    expect(img).not.toBeNull()
    fireEvent.error(img)
    expect(container.querySelector('img')).toBeNull()
    expect(screen.getByText('B')).toBeInTheDocument()
  })

  it('url yoxdursa birbaşa baş hərf', () => {
    const { container } = render(<BrandLogo name="Savora" />)
    expect(container.querySelector('img')).toBeNull()
    expect(screen.getByText('S')).toBeInTheDocument()
  })
})

describe('intro (splash) ekranı', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    document.body.insertAdjacentHTML('beforeend', '<div id="splash" role="status"></div>')
  })
  afterEach(() => {
    vi.useRealTimers()
    document.getElementById('splash')?.remove()
  })

  it('hideSplash ekranı solduraraq silir və təkrar çağırışa dözümlüdür', () => {
    hideSplash()
    hideSplash()
    expect(document.getElementById('splash').classList.contains('splash-hide')).toBe(true)
    act(() => vi.advanceTimersByTime(600))
    expect(document.getElementById('splash')).toBeNull()
    expect(() => hideSplash()).not.toThrow()
  })

  it('SplashGate: menyu yüklənməyibsə intro qalır, yüklənəndə götürülür', () => {
    wrap(<SplashGate />)
    act(() => vi.advanceTimersByTime(2000))
    expect(document.getElementById('splash')).not.toBeNull()
    expect(document.getElementById('splash').classList.contains('splash-hide')).toBe(false)
    act(() => useMenuStore.setState({ status: 'ready' }))
    act(() => vi.advanceTimersByTime(1500))
    expect(document.getElementById('splash')).toBeNull()
  })

  it('SplashGate: menyu xətası (oflayn) intro-nu ilişdirmir', () => {
    useRestaurantStore.setState({ restaurant: null })
    useMenuStore.setState({ status: 'error' })
    wrap(<SplashGate />)
    act(() => vi.advanceTimersByTime(1500))
    expect(document.getElementById('splash')).toBeNull()
  })

  it('SplashGate: heç nə yüklənməsə belə 8 saniyədən sonra intro götürülür', () => {
    wrap(<SplashGate />)
    act(() => vi.advanceTimersByTime(9000))
    expect(document.getElementById('splash')).toBeNull()
  })

  it('SplashGate: işçi səhifələrində (admin) tətbiq açılan kimi götürülür', () => {
    wrap(<SplashGate />, '/admin/orders')
    act(() => vi.advanceTimersByTime(1500))
    expect(document.getElementById('splash')).toBeNull()
  })

  it('saveBrand restoran adını yadda saxlayır ki, növbəti girişdə intro brendli açılsın', () => {
    saveBrand({ name: 'By Orxan', logo_url: '' }, { primary: '#7a1f1f', background: '#faf6ef' })
    expect(JSON.parse(localStorage.getItem('qrmenu_brand'))).toMatchObject({ name: 'By Orxan', primary: '#7a1f1f' })
  })
})

describe('masa etiketi', () => {
  it('"Masa 1" etiketi təkrar "MASA — MASA 1" kimi yazılmır; digər etiketlər prefikslə göstərilir', async () => {
    const { tableText } = await import('../lib/tableLabel')
    const t = (k) => ({ table_label: 'Masa' })[k]
    expect(tableText(t, { label: 'Masa 1' })).toBe('Masa 1')
    expect(tableText(t, { label: 'masa 7' })).toBe('masa 7')
    expect(tableText(t, { label: 'VIP 2' })).toBe('Masa — VIP 2')
    expect(tableText(t, null)).toBe('')
  })

  it('başlıqda təkrar yoxdur', () => {
    wrap(<SiteHeader />)
    expect(screen.getByText('MASA 1', { exact: false })).toBeInTheDocument()
    expect(screen.queryByText(/MASA — MASA 1/i)).toBeNull()
  })
})

describe('tema şrifti', () => {
  it('Roman serif (Times New Roman) sistem şrifti kimi tətbiq olunur — Google Fonts yüklənmir', async () => {
    const { applyTheme, FONT_OPTIONS } = await import('../lib/theme')
    expect(FONT_OPTIONS).toContain('Times New Roman')
    applyTheme({ font: 'Times New Roman' })
    expect(document.documentElement.style.getPropertyValue('--font-display')).toContain('"Times New Roman", Times')
    expect(document.head.querySelector('link[href*="fonts.googleapis.com"][href*="Times"]')).toBeNull()
  })
})
