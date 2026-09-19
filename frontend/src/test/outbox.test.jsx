import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, ordersApi: { create: vi.fn(), quote: vi.fn(), get: vi.fn(), list: vi.fn(), updateStatus: vi.fn() } }
})

import { ordersApi } from '../lib/api'
import { useOutboxStore } from '../store/outboxStore'
import { useMyOrdersStore } from '../store/myOrdersStore'
import { useCartStore } from '../store/cartStore'
import { useMenuStore } from '../store/menuStore'
import { useTableSessionStore } from '../store/tableSessionStore'
import { useRestaurantStore } from '../store/restaurantStore'
import { useLocaleStore } from '../store/localeStore'
import Cart from '../pages/Cart'
import MyOrders from '../pages/MyOrders'

const ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
const payload = { customer_name: 'Ali', phone: '+994501112233', items: [{ product_id: 1, quantity: 2 }], expected_total: 40 }
const httpError = (status, data) => Object.assign(new Error('http'), { response: { status, data } })
const networkError = () => Object.assign(new Error('Network Error'), { response: undefined })

const setOnline = (v) => Object.defineProperty(navigator, 'onLine', { value: v, configurable: true })

beforeEach(() => {
  vi.clearAllMocks()
  setOnline(true)
  useOutboxStore.setState({ items: [], flushing: false })
  useMyOrdersStore.setState({ refs: [] })
  useLocaleStore.setState({ locale: 'az' })
})
afterEach(() => setOnline(true))

describe('outboxStore.flush', () => {
  it('uğurlu göndərmədə sifarişi növbədən çıxarır, tokeni sifarişlərimə yazır və eyni client_request_id göndərir', async () => {
    ordersApi.create.mockResolvedValue({ id: 12, access_token: 'tok' })
    useOutboxStore.getState().enqueue(ID, payload, { count: 2, total: 40 })
    const sent = await useOutboxStore.getState().flush()
    expect(sent).toHaveLength(1)
    expect(ordersApi.create).toHaveBeenCalledWith({ ...payload, client_request_id: ID })
    expect(useOutboxStore.getState().items).toHaveLength(0)
    expect(useMyOrdersStore.getState().refs[0]).toMatchObject({ id: 12, token: 'tok' })
  })

  it('offline olanda heç nə göndərmir', async () => {
    setOnline(false)
    useOutboxStore.getState().enqueue(ID, payload, {})
    expect(await useOutboxStore.getState().flush()).toEqual([])
    expect(ordersApi.create).not.toHaveBeenCalled()
  })

  it('şəbəkə xətasında və 5xx-də sifariş növbədə qalır (sonra təkrar cəhd)', async () => {
    useOutboxStore.getState().enqueue(ID, payload, {})
    ordersApi.create.mockRejectedValueOnce(networkError())
    await useOutboxStore.getState().flush()
    expect(useOutboxStore.getState().items[0].status).toBe('pending')
    ordersApi.create.mockRejectedValueOnce(httpError(503, { error: 'x' }))
    await useOutboxStore.getState().flush()
    expect(useOutboxStore.getState().items[0].status).toBe('pending')
  })

  it('qiymət dəyişibsə needs_confirm olur; təsdiqdən sonra yeni məbləğlə və EYNİ ID ilə göndərilir', async () => {
    ordersApi.create.mockRejectedValueOnce(httpError(409, { code: 'PRICE_CHANGED', total: 44, previous_total: 40 }))
    useOutboxStore.getState().enqueue(ID, payload, {})
    await useOutboxStore.getState().flush()
    expect(useOutboxStore.getState().items[0]).toMatchObject({ status: 'needs_confirm', quote: { total: 44, previous_total: 40 } })

    ordersApi.create.mockResolvedValueOnce({ id: 13, access_token: 't2' })
    const sent = await useOutboxStore.getState().confirmPrice(ID)
    expect(sent).toHaveLength(1)
    expect(ordersApi.create).toHaveBeenLastCalledWith(expect.objectContaining({ client_request_id: ID, expected_total: 44 }))
    expect(useOutboxStore.getState().items).toHaveLength(0)
  })

  it('serverin rədd etdiyi (məs. məhsul bitib) sifariş failed olur və təkrar göndərilmir', async () => {
    ordersApi.create.mockRejectedValue(httpError(400, { error: 'Məhsul hazırda mövcud deyil: 1' }))
    useOutboxStore.getState().enqueue(ID, payload, {})
    await useOutboxStore.getState().flush()
    await useOutboxStore.getState().flush()
    expect(useOutboxStore.getState().items[0]).toMatchObject({ status: 'failed', error: 'Məhsul hazırda mövcud deyil: 1' })
    expect(ordersApi.create).toHaveBeenCalledTimes(1)
  })

  it('paralel flush çağırışları eyni sifarişi iki dəfə göndərmir', async () => {
    let resolve
    ordersApi.create.mockReturnValue(new Promise((r) => (resolve = r)))
    useOutboxStore.getState().enqueue(ID, payload, {})
    const a = useOutboxStore.getState().flush()
    const b = useOutboxStore.getState().flush()
    resolve({ id: 1, access_token: 't' })
    await Promise.all([a, b])
    expect(ordersApi.create).toHaveBeenCalledTimes(1)
  })

  it('eyni ID ikinci dəfə növbəyə əlavə olunmur', () => {
    useOutboxStore.getState().enqueue(ID, payload, {})
    useOutboxStore.getState().enqueue(ID, payload, {})
    expect(useOutboxStore.getState().items).toHaveLength(1)
  })
})

describe('Cart: offline növbə və qiymət dəyişikliyi', () => {
  const item = { product_id: 1, name: 'Pasta', price: 20, image_url: '', quantity: 2 }

  async function fillAndSubmit() {
    await userEvent.click(screen.getByRole('button', { name: 'Davam et' }))
    await userEvent.type(screen.getByPlaceholderText('Ad Soyad'), 'Ali')
    await userEvent.type(screen.getByPlaceholderText(/\+994/), '+994501112233')
    await userEvent.click(screen.getByRole('button', { name: 'Sifarişi təsdiqlə' }))
    await userEvent.click(screen.getByRole('button', { name: 'Təsdiqlə', exact: true }))
  }

  function renderCart() {
    return render(
      <MemoryRouter initialEntries={['/cart']}>
        <Routes>
          <Route path="/cart" element={<Cart />} />
          <Route path="/orders" element={<p>orders sehifesi</p>} />
          <Route path="/order/:id" element={<p>order status</p>} />
        </Routes>
      </MemoryRouter>,
    )
  }

  beforeEach(() => {
    useCartStore.setState({ items: [item] })
    useMenuStore.setState({ status: 'ready', products: [{ id: 1, price: 20, is_available: true }], categories: [] })
    useTableSessionStore.setState({ table: { code: 'table_001', label: 'Masa 1' } })
    useRestaurantStore.setState({ restaurant: { allow_tableless_orders: false } })
    ordersApi.quote.mockResolvedValue({ subtotal: 40, discount: 0, service_fee: 0, vat: 0, delivery_fee: 0, total: 40, promo_error: null })
  })

  it('internet yoxdursa sifariş növbəyə düşür, səbət təmizlənir, /orders-ə keçir', async () => {
    renderCart()
    await waitFor(() => expect(ordersApi.quote).toHaveBeenCalled())
    setOnline(false)
    await fillAndSubmit()
    await waitFor(() => expect(screen.getByText('orders sehifesi')).toBeInTheDocument())
    expect(ordersApi.create).not.toHaveBeenCalled()
    const [queued] = useOutboxStore.getState().items
    expect(queued).toMatchObject({ status: 'pending', summary: { count: 2 } })
    expect(queued.payload).toMatchObject({ customer_name: 'Ali', table_code: 'table_001' })
    expect(useCartStore.getState().items).toHaveLength(0)
  })

  it('sorğu şəbəkədə kəsilərsə də (server cavabı yoxdur) sifariş itmir, növbəyə düşür', async () => {
    ordersApi.create.mockRejectedValue(networkError())
    renderCart()
    await waitFor(() => expect(ordersApi.quote).toHaveBeenCalled())
    await fillAndSubmit()
    await waitFor(() => expect(useOutboxStore.getState().items).toHaveLength(1))
    expect(ordersApi.create).toHaveBeenCalledWith(expect.objectContaining({ client_request_id: expect.stringMatching(/.{16,}/) }))
  })

  it('uğurlu sifarişdə gördüyü məbləği (expected_total) backend-ə göndərir', async () => {
    ordersApi.create.mockResolvedValue({ id: 5, access_token: 'tk' })
    renderCart()
    await waitFor(() => expect(ordersApi.quote).toHaveBeenCalled())
    await new Promise((r) => setTimeout(r, 50))
    await fillAndSubmit()
    await waitFor(() => expect(screen.getByText('order status')).toBeInTheDocument())
    expect(ordersApi.create.mock.calls[0][0].expected_total).toBe(40)
  })

  it('backend PRICE_CHANGED (409) qaytararsa dialoq açılır; təsdiqdə yeni məbləğlə eyni ID ilə yenidən göndərilir', async () => {
    ordersApi.create
      .mockRejectedValueOnce(httpError(409, { code: 'PRICE_CHANGED', previous_total: 40, total: 44, breakdown: { subtotal: 44, total: 44 } }))
      .mockResolvedValueOnce({ id: 6, access_token: 'tk' })
    renderCart()
    await waitFor(() => expect(ordersApi.quote).toHaveBeenCalled())
    await fillAndSubmit()
    const dialog = await screen.findByRole('dialog', { name: 'Qiymət dəyişib' })
    expect(dialog).toHaveTextContent('40.00')
    expect(dialog).toHaveTextContent('44.00')
    expect(useOutboxStore.getState().items).toHaveLength(0)
    await userEvent.click(screen.getByRole('button', { name: 'Yeni məbləği təsdiqlə' }))
    await waitFor(() => expect(screen.getByText('order status')).toBeInTheDocument())
    expect(ordersApi.create.mock.calls[1][0].expected_total).toBe(44)
    expect(ordersApi.create.mock.calls[1][0].client_request_id).toBe(ordersApi.create.mock.calls[0][0].client_request_id)
  })

  it('dialoqda ləğv edərsə sifariş göndərilmir', async () => {
    ordersApi.create.mockRejectedValueOnce(httpError(409, { code: 'PRICE_CHANGED', previous_total: 40, total: 44 }))
    renderCart()
    await waitFor(() => expect(ordersApi.quote).toHaveBeenCalled())
    await fillAndSubmit()
    await screen.findByRole('dialog', { name: 'Qiymət dəyişib' })
    await userEvent.click(screen.getByRole('button', { name: 'Ləğv et' }))
    expect(screen.queryByRole('dialog', { name: 'Qiymət dəyişib' })).toBeNull()
    expect(ordersApi.create).toHaveBeenCalledTimes(1)
  })
})

describe('MyOrders: növbədəki sifarişlər', () => {
  const renderOrders = () => render(<MemoryRouter><MyOrders /></MemoryRouter>)

  it('gözləyən, qiyməti dəyişən və rədd edilən sifarişləri göstərir', () => {
    useOutboxStore.setState({
      items: [
        { id: 'a'.repeat(20), status: 'pending', summary: { count: 2, total: 40 }, payload: {} },
        { id: 'b'.repeat(20), status: 'needs_confirm', summary: { count: 1, total: 20 }, quote: { total: 22, previous_total: 20 }, payload: {} },
        { id: 'c'.repeat(20), status: 'failed', error: 'Məhsul bitib', summary: { count: 1, total: 9 }, payload: {} },
      ],
    })
    renderOrders()
    expect(screen.getAllByTestId('outbox-item')).toHaveLength(3)
    expect(screen.getByText(/İnternet gözlənilir/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Yeni məbləği təsdiqlə' })).toBeInTheDocument()
    expect(screen.getByText(/Məhsul bitib/)).toBeInTheDocument()
  })

  it('rədd edilmiş elementi silmək olur', async () => {
    useOutboxStore.setState({ items: [{ id: 'c'.repeat(20), status: 'failed', error: 'x', summary: {}, payload: {} }] })
    renderOrders()
    await userEvent.click(screen.getByRole('button', { name: 'Sil' }))
    expect(useOutboxStore.getState().items).toHaveLength(0)
  })
})
