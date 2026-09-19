import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import Menu from '../pages/Menu'
import ProductDetail from '../pages/ProductDetail'
import { useMenuStore } from '../store/menuStore'
import { useLocaleStore } from '../store/localeStore'
import { useTableSessionStore } from '../store/tableSessionStore'

const categories = [
  { id: 1, name: 'Desertlər', name_en: 'Desserts', sort_order: 1 },
  { id: 2, name: 'İçkilər', name_en: 'Drinks', sort_order: 2 },
]
const ingredients = [
  { id: 10, name: 'Şokolad', name_en: 'Chocolate' },
  { id: 11, name: 'Portağal', name_en: 'Orange' },
]
const products = [
  { id: 1, category_id: 1, name: 'Sufle', price: 8, is_available: true, ingredient_ids: [10], allergen_ids: [] },
  { id: 2, category_id: 2, name: 'Təzə şirə', price: 5, is_available: true, ingredient_ids: [11], allergen_ids: [] },
  { id: 3, category_id: 1, name: 'Kürəcik', price: 6, is_available: true, ingredient_ids: [], ingredients: 'Vanil, qaymaq', allergen_ids: [] },
]

beforeEach(() => {
  useLocaleStore.setState({ locale: 'az' })
  useTableSessionStore.setState({ table: null })
  useMenuStore.setState({ products, categories, ingredients, allergens: [], status: 'ready' })
})

const renderMenu = () => render(<MemoryRouter><Menu /></MemoryRouter>)
const shown = () => screen.queryAllByRole('link', { name: /Sufle|Təzə şirə|Kürəcik/ }).map((a) => a.textContent)

describe('müştəri axtarışı (ad, təsvir, kateqoriya, tərkib)', () => {
  it('kateqoriya adı ilə tapır', async () => {
    renderMenu()
    await userEvent.type(screen.getByPlaceholderText(/axtar/i), 'içki')
    expect(shown()).toHaveLength(1)
    expect(shown()[0]).toContain('Təzə şirə')
  })

  it('kataloq tərkib komponenti ilə tapır', async () => {
    renderMenu()
    await userEvent.type(screen.getByPlaceholderText(/axtar/i), 'şokolad')
    expect(shown()).toHaveLength(1)
    expect(shown()[0]).toContain('Sufle')
  })

  it('kataloqa köçürülməmiş köhnə tərkib mətni ilə də tapır', async () => {
    renderMenu()
    await userEvent.type(screen.getByPlaceholderText(/axtar/i), 'qaymaq')
    expect(shown()[0]).toContain('Kürəcik')
  })

  it('cari dildəki (EN) ad/tərcümə ilə axtarır', async () => {
    useLocaleStore.setState({ locale: 'en' })
    renderMenu()
    await userEvent.type(screen.getByPlaceholderText(/search/i), 'chocolate')
    expect(shown()).toHaveLength(1)
    await userEvent.clear(screen.getByPlaceholderText(/search/i))
    await userEvent.type(screen.getByPlaceholderText(/search/i), 'drinks')
    expect(shown()[0]).toContain('Təzə şirə')
  })

  it('tapılmayanda boş vəziyyət göstərilir', async () => {
    renderMenu()
    await userEvent.type(screen.getByPlaceholderText(/axtar/i), 'yoxdurbelə')
    expect(shown()).toHaveLength(0)
    expect(screen.getByText('Heç nə tapılmadı')).toBeInTheDocument()
  })
})

describe('məhsul səhifəsi: tapılmayan/gizli məhsul', () => {
  const renderDetail = () =>
    render(
      <MemoryRouter initialEntries={['/product/99']}>
        <Routes><Route path="/product/:id" element={<ProductDetail />} /></Routes>
      </MemoryRouter>,
    )

  it('menyu yüklənib, məhsul yoxdursa izahat və "menyuya qayıt" göstərilir (sonsuz "..." yox)', () => {
    renderDetail()
    expect(screen.getByTestId('product-missing')).toHaveTextContent('Məhsul tapılmadı')
    expect(screen.getByRole('link', { name: 'Menyuya qayıt' })).toHaveAttribute('href', '/menyu')
  })

  it('menyu hələ yüklənirsə yalnız gözləmə göstəricisi', () => {
    useMenuStore.setState({ status: 'loading' })
    renderDetail()
    expect(screen.getByTestId('product-missing')).toHaveTextContent('...')
    expect(screen.queryByText('Məhsul tapılmadı')).toBeNull()
  })
})
