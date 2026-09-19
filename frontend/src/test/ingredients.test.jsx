import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, ingredientsApi: { list: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() } }
})

import { ingredientsApi } from '../lib/api'
import IngredientPicker from '../admin/IngredientPicker'
import ProductDetail from '../pages/ProductDetail'
import { useMenuStore } from '../store/menuStore'
import { useLocaleStore } from '../store/localeStore'

const CATALOG = [
  { id: 1, name: 'Süd', name_en: 'Milk', name_ru: 'Молоко' },
  { id: 2, name: 'Un', name_en: 'Flour', name_ru: null },
  { id: 3, name: 'Yumurta', name_en: 'Egg', name_ru: 'Яйцо' },
]

beforeEach(() => {
  vi.clearAllMocks()
  useLocaleStore.setState({ locale: 'az' })
  useMenuStore.setState({ ingredients: CATALOG, products: [], allergens: [] })
})

describe('IngredientPicker', () => {
  it('axtarışla kataloqdan əlavə edir; sıra düymələri yerini dəyişir', async () => {
    const calls = []
    const { rerender } = render(<IngredientPicker value={[]} onChange={(v) => calls.push(v)} />)
    await userEvent.type(screen.getByPlaceholderText(/axtar/i), 'yum')
    await userEvent.click(screen.getByRole('button', { name: 'Yumurta' }))
    expect(calls.at(-1)).toEqual([3])

    rerender(<IngredientPicker value={[3, 1]} onChange={(v) => calls.push(v)} />)
    await userEvent.click(screen.getAllByLabelText('Əvvələ')[1])
    expect(calls.at(-1)).toEqual([1, 3])
    await userEvent.click(screen.getAllByLabelText('Çıxar')[0])
    expect(calls.at(-1)).toEqual([1])
  })

  it('kataloqda olmayan adı yeni komponent kimi yaradıb əlavə edir', async () => {
    ingredientsApi.create.mockResolvedValue({ id: 9, name: 'Kərə yağı', name_en: null, name_ru: null })
    const onChange = vi.fn()
    render(<IngredientPicker value={[1]} onChange={onChange} />)
    await userEvent.type(screen.getByPlaceholderText(/axtar/i), 'Kərə yağı')
    await userEvent.click(screen.getByRole('button', { name: /yeni komponent kimi əlavə et/ }))
    await waitFor(() => expect(onChange).toHaveBeenCalledWith([1, 9]))
    expect(ingredientsApi.create).toHaveBeenCalledWith({ name: 'Kərə yağı' })
    expect(useMenuStore.getState().ingredients.some((i) => i.id === 9)).toBe(true)
  })

  it('mövcud adı təkrar yaratmır (Enter ilə mövcud olan əlavə olunur)', async () => {
    const onChange = vi.fn()
    render(<IngredientPicker value={[]} onChange={onChange} />)
    await userEvent.type(screen.getByPlaceholderText(/axtar/i), 'süd{Enter}')
    expect(onChange).toHaveBeenCalledWith([1])
    expect(ingredientsApi.create).not.toHaveBeenCalled()
  })
})

describe('ProductDetail tərkib göstərilməsi', () => {
  const renderDetail = () =>
    render(
      <MemoryRouter initialEntries={['/product/5']}>
        <Routes><Route path="/product/:id" element={<ProductDetail />} /></Routes>
      </MemoryRouter>,
    )

  it('kataloq komponentlərini sıra ilə və cari dildə göstərir', () => {
    useMenuStore.setState({ products: [{ id: 5, name: 'Pasta', price: 10, is_available: true, ingredient_ids: [2, 1], ingredients: 'köhnə mətn', images: [] }] })
    renderDetail()
    expect(screen.getByText('Un, Süd')).toBeInTheDocument()
    expect(screen.queryByText('köhnə mətn')).toBeNull()
  })

  it('dil dəyişəndə tərcümə, tərcümə yoxdursa AZ ada düşür', () => {
    useLocaleStore.setState({ locale: 'ru' })
    useMenuStore.setState({ products: [{ id: 5, name: 'Pasta', price: 10, is_available: true, ingredient_ids: [1, 2], images: [] }] })
    renderDetail()
    expect(screen.getByText('Молоко, Un')).toBeInTheDocument()
  })

  it('kataloqa köçürülməmiş məhsulda köhnə mətn ehtiyatı işləyir', () => {
    useMenuStore.setState({ products: [{ id: 5, name: 'Pasta', price: 10, is_available: true, ingredient_ids: [], ingredients: 'Fettuccine, krem', images: [] }] })
    renderDetail()
    expect(screen.getByText('Fettuccine, krem')).toBeInTheDocument()
  })

  it('kataloq yeniləməsi (socket) açıq səhifədə dərhal əks olunur', () => {
    useMenuStore.setState({ products: [{ id: 5, name: 'Pasta', price: 10, is_available: true, ingredient_ids: [1], images: [] }] })
    renderDetail()
    expect(screen.getByText('Süd')).toBeInTheDocument()
    useMenuStore.getState().upsertIngredient({ id: 1, name: 'Yağsız süd', name_en: null, name_ru: null }, 'updated')
    return waitFor(() => expect(screen.getByText('Yağsız süd')).toBeInTheDocument())
  })
})
