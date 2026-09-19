import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import Menu from '../pages/Menu'
import { useMenuStore } from '../store/menuStore'
import { useTableSessionStore } from '../store/tableSessionStore'

// Kateqoriya, axtarış və səhifə URL-də saxlanılır: məhsuldan geri qayıdanda eyni görünüş açılır
const categories = [{ id: 1, name: 'Əsas', sort_order: 1 }, { id: 2, name: 'Desert', sort_order: 2 }]
const products = [
  ...Array.from({ length: 30 }, (_, i) => ({ id: i + 1, category_id: 1, name: `Yemək ${i + 1}`, price: 5, is_available: true, allergen_ids: [] })),
  ...Array.from({ length: 3 }, (_, i) => ({ id: 100 + i, category_id: 2, name: `Şirin ${i + 1}`, price: 5, is_available: true, allergen_ids: [] })),
]

function Probe() {
  const { search } = useLocation()
  return <p data-testid="search">{search}</p>
}

const renderAt = (url) => render(<MemoryRouter initialEntries={[url]}><Menu /><Probe /></MemoryRouter>)

beforeEach(() => {
  window.HTMLElement.prototype.scrollIntoView = vi.fn()
  useMenuStore.setState({ products, categories, allergens: [], status: 'ready' })
  useTableSessionStore.setState({ table: null })
})

describe('Menu görünüşü URL-də', () => {
  it('?cat=1&page=3 linki birbaşa həmin kateqoriyanın 3-cü səhifəsini açır', () => {
    renderAt('/menyu?cat=1&page=3')
    expect(screen.getByTestId('menu-pagination-summary')).toHaveTextContent('25–30 / 30')
    expect(screen.getByText('Yemək 25')).toBeInTheDocument()
    expect(screen.queryByText('Şirin 1')).toBeNull()
  })

  it('səhifə və kateqoriya dəyişəndə URL yenilənir; kateqoriya dəyişəndə səhifə 1-ə qayıdır', async () => {
    renderAt('/menyu')
    await userEvent.click(screen.getByRole('button', { name: 'Səhifə 2' }))
    await waitFor(() => expect(screen.getByTestId('search')).toHaveTextContent('page=2'))
    await userEvent.click(screen.getByRole('button', { name: 'Desert' }))
    await waitFor(() => expect(screen.getByTestId('search').textContent).toBe('?cat=2'))
    expect(screen.getAllByRole('link', { name: /Şirin/ })).toHaveLength(3)
    await userEvent.click(screen.getByRole('button', { name: 'Hamısı' }))
    await waitFor(() => expect(screen.getByTestId('search').textContent).toBe(''))
  })

  it('axtarış URL-ə yazılır və başlanğıcda oxunur; QR parametrləri saxlanılır', async () => {
    renderAt('/menyu?table=table_001&t=abc&q=Şirin')
    expect(screen.getAllByRole('link', { name: /Şirin/ })).toHaveLength(3)
    await userEvent.type(screen.getByPlaceholderText(/axtar/i), ' 2')
    await waitFor(() => expect(screen.getAllByRole('link', { name: /Şirin/ })).toHaveLength(1))
    await waitFor(() => expect(decodeURIComponent(screen.getByTestId('search').textContent)).toContain('q=Şirin+2'))
    expect(screen.getByTestId('search').textContent).toContain('table=table_001')
    expect(screen.getByTestId('search').textContent).toContain('t=abc')
  })

  it('mövcud olmayan kateqoriya və ya həddən böyük səhifə "Hamısı"/son səhifəyə düşür', async () => {
    renderAt('/menyu?cat=999&page=50')
    await waitFor(() => expect(screen.getByTestId('search').textContent).not.toContain('cat=999'))
    expect(screen.getByTestId('menu-pagination-summary')).toHaveTextContent('/ 33')
    expect(screen.getAllByRole('link').length).toBeGreaterThan(0)
  })

  it('menyu yüklənənə qədər ?page=3 URL-dən silinmir', async () => {
    useMenuStore.setState({ products: [], status: 'loading' })
    renderAt('/menyu?cat=1&page=3')
    expect(screen.getByTestId('search').textContent).toBe('?cat=1&page=3')
    useMenuStore.setState({ products, status: 'ready' })
    await waitFor(() => expect(screen.getByTestId('menu-pagination-summary')).toHaveTextContent('25–30 / 30'))
    expect(screen.getByTestId('search').textContent).toBe('?cat=1&page=3')
  })
})
