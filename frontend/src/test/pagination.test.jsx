import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'

vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, ordersApi: { listPage: vi.fn(), get: vi.fn(), create: vi.fn(), quote: vi.fn(), list: vi.fn(), updateStatus: vi.fn() } }
})

import { ordersApi } from '../lib/api'
import { useOrderStore } from '../store/orderStore'
import { useMenuStore } from '../store/menuStore'
import { useLocaleStore } from '../store/localeStore'
import { useTableSessionStore } from '../store/tableSessionStore'
import Menu from '../pages/Menu'
import ErrorBoundary from '../components/ErrorBoundary'
import LoadMore from '../components/LoadMore'
import App from '../App'

const orders = (from, to) => Array.from({ length: from - to + 1 }, (_, i) => ({ id: from - i, status: 'NEW' }))

beforeEach(() => {
  vi.clearAllMocks()
  useOrderStore.setState({ orders: [], filters: {}, hasMore: false, loadingMore: false })
  useLocaleStore.setState({ locale: 'az' })
})

describe('orderStore: kursor səhifələmə', () => {
  it('fetchOrders filtr və limit göndərir, hasMore-u saxlayır', async () => {
    ordersApi.listPage.mockResolvedValue({ items: orders(100, 71), hasMore: true })
    await useOrderStore.getState().fetchOrders({ limit: 30, status: 'NEW' })
    expect(ordersApi.listPage).toHaveBeenCalledWith({ limit: 30, status: 'NEW' })
    expect(useOrderStore.getState().orders).toHaveLength(30)
    expect(useOrderStore.getState().hasMore).toBe(true)
  })

  it('loadMore ən köhnə göstərilən ID-dən əvvəlkiləri əlavə edir (təkrar olmadan) və hasMore yenilənir', async () => {
    ordersApi.listPage.mockResolvedValueOnce({ items: orders(100, 71), hasMore: true })
    await useOrderStore.getState().fetchOrders({ limit: 30 })
    ordersApi.listPage.mockResolvedValueOnce({ items: [...orders(71, 42)], hasMore: false }) // 71 təkrardır
    await useOrderStore.getState().loadMore()
    expect(ordersApi.listPage).toHaveBeenLastCalledWith({ limit: 30, before: 71 })
    const ids = useOrderStore.getState().orders.map((o) => o.id)
    expect(ids).toHaveLength(59)
    expect(new Set(ids).size).toBe(59)
    expect(useOrderStore.getState().hasMore).toBe(false)
  })

  it('daha yoxdursa və ya artıq yüklənirsə loadMore heç nə göndərmir', async () => {
    useOrderStore.setState({ orders: orders(10, 1), hasMore: false })
    await useOrderStore.getState().loadMore()
    useOrderStore.setState({ hasMore: true, loadingMore: true })
    await useOrderStore.getState().loadMore()
    expect(ordersApi.listPage).not.toHaveBeenCalled()
  })

  it('socket yeniləməsi (parametrsiz fetchOrders) artıq açılmış səhifələrin sayını saxlayır — siyahı ilk səhifəyə qayıtmır', async () => {
    useOrderStore.setState({ orders: orders(100, 41), filters: { limit: 30, status: 'NEW' }, hasMore: true })
    ordersApi.listPage.mockResolvedValue({ items: orders(101, 42), hasMore: true })
    await useOrderStore.getState().fetchOrders()
    expect(ordersApi.listPage).toHaveBeenCalledWith({ limit: 60, status: 'NEW' })
  })

  it('parametrsiz yeniləmə backend maksimumunu (200) aşmır', async () => {
    useOrderStore.setState({ orders: orders(500, 201), filters: { limit: 30 } })
    ordersApi.listPage.mockResolvedValue({ items: [], hasMore: false })
    await useOrderStore.getState().fetchOrders()
    expect(ordersApi.listPage.mock.calls[0][0].limit).toBe(200)
  })
})

describe('Menu: nömrəli səhifələmə (məhsullar və kateqoriyalar)', () => {
  const products = Array.from({ length: 30 }, (_, i) => ({ id: i + 1, category_id: 1, name: `Yemək ${i + 1}`, price: 5, is_available: true, allergen_ids: [] }))
  const categories = Array.from({ length: 15 }, (_, i) => ({ id: i + 1, name: `Kat ${i + 1}`, sort_order: i + 1 }))

  beforeEach(() => {
    window.HTMLElement.prototype.scrollIntoView = vi.fn()
    useMenuStore.setState({ products, categories: [{ id: 1, name: 'Əsas', sort_order: 1 }], allergens: [], status: 'ready' })
    useTableSessionStore.setState({ table: null })
  })

  const renderMenu = () => render(<MemoryRouter><Menu /></MemoryRouter>)

  it('səhifədə 12 yemək; nömrələr və ‹ › ilə keçid, "1–12 / 30" xülasəsi', async () => {
    renderMenu()
    expect(screen.getAllByRole('link', { name: /Yemək/ })).toHaveLength(12)
    expect(screen.getByTestId('menu-pagination-summary')).toHaveTextContent('1–12 / 30')
    expect(screen.getByRole('button', { name: 'Əvvəlki səhifə' })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: 'Səhifə 2' }))
    expect(screen.getByText('Yemək 13')).toBeInTheDocument()
    expect(screen.queryByText('Yemək 1')).toBeNull()
    expect(screen.getByRole('button', { name: 'Səhifə 2' })).toHaveAttribute('aria-current', 'page')
    expect(window.HTMLElement.prototype.scrollIntoView).toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Növbəti səhifə' }))
    expect(screen.getAllByRole('link', { name: /Yemək/ })).toHaveLength(6)
    expect(screen.getByTestId('menu-pagination-summary')).toHaveTextContent('25–30 / 30')
    expect(screen.getByRole('button', { name: 'Növbəti səhifə' })).toBeDisabled()
  })

  it('axtarış dəyişəndə yenidən 1-ci səhifədən başlayır', async () => {
    renderMenu()
    await userEvent.click(screen.getByRole('button', { name: 'Səhifə 3' }))
    await userEvent.type(screen.getByPlaceholderText(/axtar/i), 'Yemək 2')
    // "Yemək 2", "Yemək 20"..."Yemək 29" = 11 nəticə → bir səhifə, səhifələmə paneli yoxdur
    await waitFor(() => expect(screen.getAllByRole('link', { name: /Yemək/ })).toHaveLength(11))
    expect(screen.queryByTestId('menu-pagination')).toBeNull()
  })

  it('kiçik siyahıda səhifələmə paneli göstərilmir', () => {
    useMenuStore.setState({ products: products.slice(0, 5) })
    renderMenu()
    expect(screen.queryByTestId('menu-pagination')).toBeNull()
  })

  it('kateqoriya tab-ları səhifələnir: "Hamısı" sabit qalır, ‹ › ilə digər kateqoriyalar', async () => {
    useMenuStore.setState({ categories, products: categories.map((c) => ({ id: 100 + c.id, category_id: c.id, name: `Məhsul ${c.id}`, price: 5, is_available: true, allergen_ids: [] })) })
    renderMenu()
    // jsdom eni 1024 → kompüter: səhifədə 6 kateqoriya, cəmi 15 → 3 səhifə
    expect(screen.getByTestId('category-page')).toHaveTextContent('1/3')
    expect(screen.getByRole('button', { name: 'Hamısı' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Kat 6' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Kat 7' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Əvvəlki kateqoriyalar' })).toBeDisabled()

    await userEvent.click(screen.getByRole('button', { name: 'Növbəti kateqoriyalar' }))
    expect(screen.getByTestId('category-page')).toHaveTextContent('2/3')
    expect(screen.getByRole('button', { name: 'Hamısı' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Kat 6' })).toBeNull()

    // 2-ci səhifədəki kateqoriya seçilir → yalnız onun məhsulları
    await userEvent.click(screen.getByRole('button', { name: 'Kat 9' }))
    expect(screen.getAllByRole('link', { name: /Məhsul/ })).toHaveLength(1)
    expect(screen.getByText('Məhsul 9')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Növbəti kateqoriyalar' }))
    await userEvent.click(screen.getByRole('button', { name: 'Növbəti kateqoriyalar' }).closest('div').querySelector('button[aria-label="Əvvəlki kateqoriyalar"]'))
    expect(screen.getByTestId('category-page')).toHaveTextContent('2/3')
  })

  it('az kateqoriya olanda tab səhifələməsi göstərilmir', () => {
    useMenuStore.setState({ categories: categories.slice(0, 4) })
    renderMenu()
    expect(screen.queryByTestId('category-page')).toBeNull()
  })
})

describe('LoadMore', () => {
  it('hasMore=false olanda heç nə render etmir; loading zamanı düymə söndürülür', () => {
    const { container, rerender } = render(<LoadMore hasMore={false} onMore={() => {}} />)
    expect(container).toBeEmptyDOMElement()
    rerender(<LoadMore hasMore loading onMore={() => {}} />)
    expect(screen.getByRole('button')).toBeDisabled()
  })
})

describe('ErrorBoundary', () => {
  function Boom({ message }) {
    throw new Error(message)
  }

  it('render xətasında boş ekran əvəzinə mesaj və düymələr göstərir', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<ErrorBoundary><Boom message="pis" /></ErrorBoundary>)
    spy.mockRestore()
    expect(screen.getByRole('alert')).toHaveTextContent('Xəta baş verdi')
    expect(screen.getByRole('button', { name: 'Yenidən cəhd et' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Səhifəni yenilə' })).toBeInTheDocument()
  })

  it('lazy səhifə (chunk) yüklənməyəndə internet bağlantısı barədə xüsusi mesaj verir', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<ErrorBoundary><Boom message="Failed to fetch dynamically imported module: /assets/x.js" /></ErrorBoundary>)
    spy.mockRestore()
    expect(screen.getByRole('alert')).toHaveTextContent('Səhifə yüklənmədi')
  })

  it('"Yenidən cəhd et" xətanı təmizləyib uşaqları yenidən render edir', async () => {
    let fail = true
    function Flaky() {
      if (fail) throw new Error('bir dəfəlik')
      return <p>işləyir</p>
    }
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<ErrorBoundary><Flaky /></ErrorBoundary>)
    fail = false
    await userEvent.click(screen.getByRole('button', { name: 'Yenidən cəhd et' }))
    spy.mockRestore()
    expect(screen.getByText('işləyir')).toBeInTheDocument()
  })
})

describe('/menu alias (PDF: ümumi menyu linki)', () => {
  function Where() {
    const { pathname, search } = useLocation()
    return <p data-testid="where">{pathname + search}</p>
  }

  it('/menu → /menyu, sorğu parametrləri (masa QR-ı) saxlanılır', async () => {
    useMenuStore.setState({ products: [], categories: [], allergens: [], status: 'ready' })
    render(
      <MemoryRouter initialEntries={['/menu?table=table_005&t=abc']}>
        <App />
        <Where />
      </MemoryRouter>,
    )
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/menyu?table=table_005&t=abc'))
  })

  it('bilinməyən yol 404 səhifəsini göstərir (lazy chunk-lar da ağ ekran yaratmır)', async () => {
    render(<MemoryRouter initialEntries={['/yoxdur']}><App /></MemoryRouter>)
    expect(await screen.findByText('404')).toBeInTheDocument()
  })
})
