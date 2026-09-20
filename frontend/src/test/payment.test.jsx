import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    ordersApi: { create: vi.fn(), quote: vi.fn().mockResolvedValue(null), get: vi.fn(), list: vi.fn(), listPage: vi.fn(), updateStatus: vi.fn() },
    paymentsApi: { start: vi.fn(), verify: vi.fn(), testComplete: vi.fn(), markPaid: vi.fn(), refund: vi.fn(), list: vi.fn() },
  }
})

import { ordersApi, paymentsApi } from '../lib/api'
import { useCartStore } from '../store/cartStore'
import { useMenuStore } from '../store/menuStore'
import { useTableSessionStore } from '../store/tableSessionStore'
import { useRestaurantStore } from '../store/restaurantStore'
import { useMyOrdersStore } from '../store/myOrdersStore'
import { useLocaleStore } from '../store/localeStore'
import { useOrderStore } from '../store/orderStore'
import { useOutboxStore } from '../store/outboxStore'
import { useAuthStore } from '../store/authStore'
import { enabledMethods, awaitingOnlinePayment } from '../lib/payment'
import Cart from '../pages/Cart'
import PaymentPanel from '../components/PaymentPanel'
import TestPay from '../pages/TestPay'
import OrdersAdmin from '../admin/OrdersAdmin'

const setOnline = (v) => Object.defineProperty(navigator, 'onLine', { value: v, configurable: true })
const item = { product_id: 1, name: 'Pasta', price: 20, image_url: '', quantity: 2 }
const baseOrder = { id: 7, status: 'NEW', payment_method: 'ONLINE', payment_status: 'PENDING', total: 40, customer_name: 'Ali', created_at: new Date().toISOString() }

let assign
beforeEach(() => {
  vi.clearAllMocks()
  setOnline(true)
  assign = vi.fn()
  Object.defineProperty(window, 'location', { value: { ...window.location, assign }, writable: true, configurable: true })
  useLocaleStore.setState({ locale: 'az' })
  useCartStore.setState({ items: [item] })
  useMenuStore.setState({ products: [{ id: 1, price: 20, is_available: true }], status: 'ready' })
  useTableSessionStore.setState({ table: { code: 't1', label: 'Masa 1' } })
  useRestaurantStore.setState({ restaurant: { pay_cash: true, pay_card_pos: true, pay_online: true, online_payment_available: true } })
  useMyOrdersStore.setState({ refs: [] })
  useOutboxStore.setState({ items: [], flushing: false })
  useOrderStore.setState({ orders: [], currentOrder: null })
})
afterEach(() => setOnline(true))

describe('enabledMethods', () => {
  it('restoran ayarı və provayder əlçatanlığına görə; ən azı NAĞD həmişə var', () => {
    expect(enabledMethods({ pay_cash: true, pay_card_pos: true, pay_online: true, online_payment_available: true })).toEqual(['CASH', 'CARD_POS', 'ONLINE'])
    expect(enabledMethods({ pay_online: true, online_payment_available: false })).toEqual(['CASH', 'CARD_POS'])
    expect(enabledMethods({ pay_cash: false, pay_card_pos: false })).toEqual(['CASH'])
    expect(enabledMethods(null)).toEqual(['CASH', 'CARD_POS'])
  })
  it('awaitingOnlinePayment yalnız onlayn PENDING/FAILED üçün', () => {
    expect(awaitingOnlinePayment({ payment_method: 'ONLINE', payment_status: 'PENDING' })).toBe(true)
    expect(awaitingOnlinePayment({ payment_method: 'ONLINE', payment_status: 'FAILED' })).toBe(true)
    expect(awaitingOnlinePayment({ payment_method: 'ONLINE', payment_status: 'PAID' })).toBe(false)
    expect(awaitingOnlinePayment({ payment_method: 'CASH', payment_status: 'UNPAID' })).toBe(false)
  })
})

async function openCheckout() {
  render(<MemoryRouter initialEntries={['/cart']}><Routes><Route path="/cart" element={<Cart />} /><Route path="/order/:id" element={<p>Sifariş səhifəsi</p>} /></Routes></MemoryRouter>)
  await userEvent.click(screen.getByRole('button', { name: 'Davam et' }))
  await userEvent.type(screen.getByPlaceholderText('Ad Soyad'), 'Ali')
  await userEvent.type(screen.getByPlaceholderText('+994 XX XXX XX XX'), '+994501112233')
}

describe('Cart: ödəniş üsulu', () => {
  it('üç üsul göstərilir, defolt NAĞD; onlayn seçiləndə düymə "Ödənişə keç" olur', async () => {
    await openCheckout()
    const radios = screen.getAllByRole('radio')
    expect(radios).toHaveLength(3)
    expect(screen.getByRole('radio', { name: /^Nağd/ })).toBeChecked()
    expect(screen.getByRole('button', { name: 'Sifarişi təsdiqlə' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('radio', { name: /Onlayn kart/ }))
    expect(screen.getByRole('button', { name: 'Ödənişə keç' })).toBeInTheDocument()
    expect(screen.getByText(/Kart məlumatlarınız restoranla paylaşılmır/)).toBeInTheDocument()
  })

  it('yalnız bir üsul varsa seçim paneli göstərilmir', async () => {
    useRestaurantStore.setState({ restaurant: { pay_cash: true, pay_card_pos: false, pay_online: false } })
    await openCheckout()
    expect(screen.queryByRole('radio')).toBeNull()
  })

  it('onlayn: sifariş ONLINE üsulu ilə yaranır, sonra ödəniş başladılır və provayder səhifəsinə yönləndirilir', async () => {
    ordersApi.create.mockResolvedValue({ id: 7, access_token: 'tok-abc' })
    paymentsApi.start.mockResolvedValue({ redirect_url: 'https://epoint.az/pay/xyz' })
    await openCheckout()
    await userEvent.click(screen.getByRole('radio', { name: /Onlayn kart/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Ödənişə keç' }))
    await userEvent.click(screen.getByRole('button', { name: 'Təsdiqlə' }))
    await waitFor(() => expect(assign).toHaveBeenCalledWith('https://epoint.az/pay/xyz'))
    expect(ordersApi.create).toHaveBeenCalledWith(expect.objectContaining({ payment_method: 'ONLINE' }))
    expect(paymentsApi.start).toHaveBeenCalledWith(7, 'tok-abc', 'az')
    expect(useCartStore.getState().items).toHaveLength(0)
  })

  it('ödəniş başlamasa müştəri sifariş səhifəsinə düşür (oradan yenidən cəhd edə bilər)', async () => {
    ordersApi.create.mockResolvedValue({ id: 7, access_token: 'tok-abc' })
    paymentsApi.start.mockRejectedValue(new Error('x'))
    await openCheckout()
    await userEvent.click(screen.getByRole('radio', { name: /Onlayn kart/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Ödənişə keç' }))
    await userEvent.click(screen.getByRole('button', { name: 'Təsdiqlə' }))
    expect(await screen.findByText('Sifariş səhifəsi')).toBeInTheDocument()
    expect(assign).not.toHaveBeenCalled()
  })

  it('nağd: ödəniş sorğusu yoxdur, sifariş NAĞD üsulu ilə göndərilir', async () => {
    ordersApi.create.mockResolvedValue({ id: 8, access_token: 'tok-1' })
    await openCheckout()
    await userEvent.click(screen.getByRole('button', { name: 'Sifarişi təsdiqlə' }))
    await userEvent.click(screen.getByRole('button', { name: 'Təsdiqlə' }))
    expect(await screen.findByText('Sifariş səhifəsi')).toBeInTheDocument()
    expect(ordersApi.create).toHaveBeenCalledWith(expect.objectContaining({ payment_method: 'CASH' }))
    expect(paymentsApi.start).not.toHaveBeenCalled()
  })

  it('oflayn + onlayn ödəniş: sifariş növbəyə qoyulmur, internet lazımdır xəbərdarlığı', async () => {
    await openCheckout()
    await userEvent.click(screen.getByRole('radio', { name: /Onlayn kart/ }))
    setOnline(false)
    await userEvent.click(screen.getByRole('button', { name: 'Ödənişə keç' }))
    await userEvent.click(screen.getByRole('button', { name: 'Təsdiqlə' }))
    expect(ordersApi.create).not.toHaveBeenCalled()
    expect(useOutboxStore.getState().items).toHaveLength(0)
  })
})

describe('PaymentPanel', () => {
  const renderPanel = (order, returned = null) => render(<MemoryRouter><PaymentPanel order={order} token="tok-abc" returned={returned} /></MemoryRouter>)
  const state = () => screen.getByTestId('payment-panel').getAttribute('data-state')

  it('gözləyən onlayn ödəniş: "İndi ödə" düyməsi ödənişi başladır', async () => {
    paymentsApi.start.mockResolvedValue({ redirect_url: 'https://epoint.az/pay/1' })
    renderPanel(baseOrder)
    expect(state()).toBe('pending')
    await userEvent.click(screen.getByRole('button', { name: 'İndi ödə' }))
    await waitFor(() => expect(assign).toHaveBeenCalledWith('https://epoint.az/pay/1'))
  })

  it('uğursuz ödəniş: "Yenidən cəhd et"', () => {
    renderPanel({ ...baseOrder, payment_status: 'FAILED' })
    expect(state()).toBe('failed')
    expect(screen.getByRole('button', { name: 'Yenidən cəhd et' })).toBeInTheDocument()
  })

  it('ödənilib / nağd (təhvil zamanı) / ləğv olunmuş sifariş', () => {
    const { unmount } = renderPanel({ ...baseOrder, payment_status: 'PAID', paid_at: new Date().toISOString() })
    expect(state()).toBe('paid')
    expect(screen.queryByRole('button')).toBeNull()
    unmount()
    const second = renderPanel({ ...baseOrder, payment_method: 'CASH', payment_status: 'UNPAID' })
    expect(state()).toBe('unpaid')
    second.unmount()
    renderPanel({ ...baseOrder, status: 'CANCELLED' })
    expect(state()).toBe('expired')
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('ödəniş səhifəsindən qayıdanda (?pay=success) URL-ə deyil, serverə güvənir: verify çağırılır, PAID gələndə təsdiq göstərilir', async () => {
    paymentsApi.verify.mockResolvedValue({ ...baseOrder, payment_status: 'PAID' })
    useOrderStore.setState({ currentOrder: baseOrder })
    function Wrapper() {
      const order = useOrderStore((s) => s.currentOrder)
      return <PaymentPanel order={order} token="tok-abc" returned="success" />
    }
    render(<MemoryRouter><Wrapper /></MemoryRouter>)
    expect(state()).toBe('verifying')
    await waitFor(() => expect(state()).toBe('paid'))
    expect(paymentsApi.verify).toHaveBeenCalledWith(7, 'tok-abc')
    expect(screen.getByText(/Ödənişiniz qəbul edildi/)).toBeInTheDocument()
  })

  it('?pay=success saxtadırsa (server hələ PENDING deyir) ödəniş "təsdiqlənmiş" göstərilmir', async () => {
    paymentsApi.verify.mockResolvedValue({ ...baseOrder, payment_status: 'FAILED' })
    useOrderStore.setState({ currentOrder: baseOrder })
    function Wrapper() {
      const order = useOrderStore((s) => s.currentOrder)
      return <PaymentPanel order={order} token="tok-abc" returned="success" />
    }
    render(<MemoryRouter><Wrapper /></MemoryRouter>)
    await waitFor(() => expect(state()).toBe('failed'))
    expect(screen.queryByText(/Ödənişiniz qəbul edildi/)).toBeNull()
  })
})

describe('TestPay (sınaq ödəniş səhifəsi)', () => {
  const renderTestPay = (url) => render(<MemoryRouter initialEntries={[url]}><Routes><Route path="/pay/test" element={<TestPay />} /><Route path="/order/:id" element={<p>Sifariş səhifəsi</p>} /></Routes></MemoryRouter>)

  it('imza olmadan ödəniş düymələri yoxdur', () => {
    renderTestPay('/pay/test')
    expect(screen.getByText('Ödəniş linki yanlışdır')).toBeInTheDocument()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('"Uğurlu ödə" backend-ə göndərir və sifariş səhifəsinə qaytarır', async () => {
    paymentsApi.testComplete.mockResolvedValue({ order_id: 7, access_token: 'tok-abc', payment_status: 'PAID' })
    renderTestPay('/pay/test?o=o7-abc&sig=deadbeef')
    await userEvent.click(screen.getByRole('button', { name: /Uğurlu ödə/ }))
    expect(await screen.findByText('Sifariş səhifəsi')).toBeInTheDocument()
    expect(paymentsApi.testComplete).toHaveBeenCalledWith({ o: 'o7-abc', sig: 'deadbeef', outcome: 'success' })
  })

  it('backend rədd edərsə (production / yanlış imza) xəta göstərilir', async () => {
    paymentsApi.testComplete.mockRejectedValue({ response: { data: { error: 'Tapılmadı' } } })
    renderTestPay('/pay/test?o=o7-abc&sig=deadbeef')
    await userEvent.click(screen.getByRole('button', { name: /Uğurlu ödə/ }))
    expect(await screen.findByText('Tapılmadı')).toBeInTheDocument()
  })
})

describe('OrdersAdmin: ödəniş', () => {
  const order = (over) => ({ id: 21, customer_name: 'Vüqar', phone: '+994', status: 'NEW', total: 30, currency: 'AZN', created_at: new Date().toISOString(), items: [], payment_method: 'CASH', payment_status: 'UNPAID', ...over })
  beforeEach(() => {
    window.scrollTo = vi.fn()
    useOrderStore.setState({ orders: [], hasMore: false, filters: {} })
  })
  const renderAdmin = (orders) => {
    ordersApi.listPage.mockResolvedValue({ items: orders, hasMore: false })
    return render(<MemoryRouter><OrdersAdmin /></MemoryRouter>)
  }

  it('nağd sifarişdə "Nağd alındı" ödənişi qeyd edir və status "Ödənilib" olur', async () => {
    paymentsApi.markPaid.mockResolvedValue({ id: 21, payment_status: 'PAID', payment_method: 'CASH' })
    renderAdmin([order()])
    const box = await screen.findByTestId('order-payment')
    expect(box).toHaveTextContent('Ödənilməyib')
    await userEvent.click(within(box).getByRole('button', { name: 'Nağd alındı' }))
    await waitFor(() => expect(screen.getByTestId('order-payment')).toHaveTextContent('Ödənilib'))
    expect(paymentsApi.markPaid).toHaveBeenCalledWith(21, 'CASH')
  })

  it('ödəniş təsdiqlənməyən onlayn sifarişdə "→ növbəti status" yoxdur, yalnız ləğv; əllə ödəniş düymələri də yoxdur', async () => {
    renderAdmin([order({ payment_method: 'ONLINE', payment_status: 'PENDING' })])
    const box = await screen.findByTestId('order-payment')
    expect(box).toHaveTextContent('Ödəniş gözlənilir')
    expect(within(box).queryByRole('button')).toBeNull()
    expect(screen.queryByRole('button', { name: /→/ })).toBeNull()
    expect(screen.getByRole('button', { name: 'Ləğv et' })).toBeInTheDocument()
  })
})

describe('OrdersAdmin: geri qaytarma', () => {
  const paidOnline = { id: 31, customer_name: 'Aygün', phone: '+994', status: 'NEW', total: 30, currency: 'AZN', created_at: new Date().toISOString(), items: [], payment_method: 'ONLINE', payment_status: 'PAID' }
  beforeEach(() => {
    window.scrollTo = vi.fn()
    useOrderStore.setState({ orders: [], hasMore: false, filters: {} })
  })
  const renderAdmin = (role) => {
    useAuthStore.setState({ admin: { id: 1, email: 'a@b.az', role } })
    ordersApi.listPage.mockResolvedValue({ items: [paidOnline], hasMore: false })
    return render(<MemoryRouter><OrdersAdmin /></MemoryRouter>)
  }

  it('OWNER/MENECER ödənilmiş onlayn sifarişi təsdiqlə geri qaytarır → "Geri qaytarılıb"', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    paymentsApi.refund.mockResolvedValue({ id: 31, payment_status: 'REFUNDED' })
    renderAdmin('OWNER')
    await userEvent.click(await screen.findByRole('button', { name: 'Pulu geri qaytar' }))
    await waitFor(() => expect(screen.getByTestId('order-payment')).toHaveTextContent('Geri qaytarılıb'))
    expect(paymentsApi.refund).toHaveBeenCalledWith(31)
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('30.00'))
  })

  it('təsdiq verilməsə heç nə göndərilmir; ofisiantda düymə yoxdur', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const { unmount } = renderAdmin('MANAGER')
    await userEvent.click(await screen.findByRole('button', { name: 'Pulu geri qaytar' }))
    expect(paymentsApi.refund).not.toHaveBeenCalled()
    unmount()
    renderAdmin('WAITER')
    await screen.findByTestId('order-payment')
    expect(screen.queryByRole('button', { name: 'Pulu geri qaytar' })).toBeNull()
  })

  it('provayder rədd edərsə xəta göstərilir, status dəyişmir', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    paymentsApi.refund.mockRejectedValue({ response: { data: { error: 'Geri qaytarma alınmadı: Rədd' } } })
    renderAdmin('OWNER')
    await userEvent.click(await screen.findByRole('button', { name: 'Pulu geri qaytar' }))
    await waitFor(() => expect(paymentsApi.refund).toHaveBeenCalled())
    expect(screen.getByTestId('order-payment')).toHaveTextContent('Ödənilib')
  })
})
