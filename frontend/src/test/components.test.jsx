import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import Button from '../components/Button'
import BottomNav from '../components/BottomNav'
import Cart from '../pages/Cart'
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
  useTableSessionStore.setState({ table: { code: 'table_001', label: 'Masa 1' } })
  useRestaurantStore.setState({ restaurant: { allow_tableless_orders: false } })
})

describe('Button', () => {
  it('to verildikdə link, əks halda button render edir', () => {
    wrap(
      <>
        <Button to="/x">Link</Button>
        <Button>Düymə</Button>
      </>,
    )
    expect(screen.getByRole('link', { name: 'Link' })).toHaveAttribute('href', '/x')
    expect(screen.getByRole('button', { name: 'Düymə' })).toBeInTheDocument()
  })

  it('disabled olduqda kliklənmir', async () => {
    let clicked = false
    wrap(<Button disabled onClick={() => (clicked = true)}>Bağlı</Button>)
    await userEvent.click(screen.getByRole('button', { name: 'Bağlı' }))
    expect(clicked).toBe(false)
  })
})

describe('BottomNav', () => {
  it('səbətdəki məhsulların sayını göstərir', () => {
    useCartStore.setState({ items: [{ product_id: 1, name: 'A', price: 5, quantity: 2 }, { product_id: 2, name: 'B', price: 5, quantity: 1 }] })
    wrap(<BottomNav />)
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Sifarişlər/ })).toHaveAttribute('href', '/orders')
  })

  it('məhsul detalı səhifəsində gizlənir', () => {
    wrap(<BottomNav />, '/product/3')
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  })
})

describe('Cart', () => {
  const item = { product_id: 1, name: 'Pasta', price: 20, image_url: '', quantity: 2 }

  it('boş səbətdə boş vəziyyət göstərir', () => {
    wrap(<Cart />, '/cart')
    expect(screen.getByText('Səbətiniz boşdur')).toBeInTheDocument()
  })

  it('menyudakı canlı qiymətə görə səbət qiymətini yeniləyir', () => {
    useCartStore.setState({ items: [item] })
    useMenuStore.setState({ status: 'ready', products: [{ id: 1, price: 24, is_available: true }] })
    wrap(<Cart />, '/cart')
    expect(screen.getAllByText('24.00 ₼').length).toBeGreaterThan(0)
    expect(screen.getAllByText('48.00 ₼').length).toBeGreaterThan(0)
  })

  it('mövcud olmayan məhsul varsa davam etməyə icazə vermir', () => {
    useCartStore.setState({ items: [item] })
    useMenuStore.setState({ status: 'ready', products: [{ id: 1, price: 20, is_available: false }] })
    wrap(<Cart />, '/cart')
    expect(screen.getByText(/mövcud deyil/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Davam et' })).toBeDisabled()
  })

  it('"Mövcud olmayanları çıxar" məhsulu səbətdən silir', async () => {
    useCartStore.setState({ items: [item] })
    useMenuStore.setState({ status: 'ready', products: [] })
    wrap(<Cart />, '/cart')
    await userEvent.click(screen.getByRole('button', { name: 'Mövcud olmayanları çıxar' }))
    expect(useCartStore.getState().items).toEqual([])
  })

  it('masasız və icazə verilməyibsə QR skan mesajı göstərir', () => {
    useTableSessionStore.setState({ table: null })
    useCartStore.setState({ items: [item] })
    useMenuStore.setState({ status: 'ready', products: [{ id: 1, price: 20, is_available: true }] })
    wrap(<Cart />, '/cart')
    expect(screen.getByText('Masada sifariş etmək üçün QR kodu skan edin.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Davam et' })).not.toBeInTheDocument()
  })

  it('formu doldurub təsdiq modalını açır', async () => {
    useCartStore.setState({ items: [item] })
    useMenuStore.setState({ status: 'ready', products: [{ id: 1, price: 20, is_available: true }] })
    wrap(<Cart />, '/cart')
    await userEvent.click(screen.getByRole('button', { name: 'Davam et' }))
    await userEvent.type(screen.getByPlaceholderText('Ad Soyad'), 'Ali')
    await userEvent.type(screen.getByPlaceholderText('+994 XX XXX XX XX'), '+994501112233')
    await userEvent.click(screen.getByRole('button', { name: 'Sifarişi təsdiqlə' }))
    expect(screen.getByText('Sifarişi təsdiqləyirsiniz?')).toBeInTheDocument()
  })
})
