import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

const products = Array.from({ length: 56 }, (_, i) => ({ id: i + 1, category_id: (i % 2) + 1, name: `Yemək ${i + 1}`, price: 10, image_url: '', is_available: true, is_visible: true }))
const categories = Array.from({ length: 19 }, (_, i) => ({ id: i + 1, name: `Kateqoriya ${i + 1}`, slug: `kat-${i + 1}`, sort_order: i, is_active: true }))

vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    productsApi: { list: vi.fn(async () => products), create: vi.fn(), update: vi.fn(), remove: vi.fn().mockResolvedValue({}), setAvailability: vi.fn(), setVisibility: vi.fn(), adjustStock: vi.fn() },
    categoriesApi: { list: vi.fn(async () => categories), create: vi.fn(), update: vi.fn(), remove: vi.fn().mockResolvedValue({}) },
    ingredientsApi: { list: vi.fn(async () => []) },
  }
})

import MenuAdmin from '../admin/MenuAdmin'
import CategoriesAdmin from '../admin/CategoriesAdmin'
import { pageWindow } from '../lib/usePagination'

beforeEach(() => {
  window.scrollTo = vi.fn()
})

const renderPage = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>)

describe('pageWindow', () => {
  it('az səhifədə hamısı, çoxda ellipsis ilə', () => {
    expect(pageWindow(1, 5)).toEqual([1, 2, 3, 4, 5])
    expect(pageWindow(1, 12)).toEqual([1, 2, 3, 4, '…', 12])
    expect(pageWindow(6, 12)).toEqual([1, '…', 5, 6, 7, '…', 12])
    expect(pageWindow(12, 12)).toEqual([1, '…', 9, 10, 11, 12])
  })
})

describe('MenuAdmin: məhsul siyahısı səhifələnir', () => {
  it('ilk səhifədə 10 məhsul, "1–10 / 56", növbəti səhifəyə keçid və səhifə ölçüsü', async () => {
    renderPage(<MenuAdmin />)
    expect(await screen.findByText('Yemək 1')).toBeInTheDocument()
    expect(screen.getAllByTestId('visibility-toggle')).toHaveLength(10)
    expect(screen.getByTestId('pagination-summary')).toHaveTextContent('1–10 / 56 məhsul')
    expect(screen.queryByText('Yemək 11')).toBeNull()

    await userEvent.click(screen.getByRole('button', { name: 'Növbəti səhifə' }))
    expect(screen.getByText('Yemək 11')).toBeInTheDocument()
    expect(screen.getByTestId('pagination-summary')).toHaveTextContent('11–20 / 56')
    expect(window.scrollTo).toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: 'Səhifə 6' }))
    expect(screen.getByTestId('pagination-summary')).toHaveTextContent('51–56 / 56')
    expect(screen.getAllByTestId('visibility-toggle')).toHaveLength(6)
    expect(screen.getByRole('button', { name: 'Növbəti səhifə' })).toBeDisabled()

    await userEvent.selectOptions(screen.getByLabelText('Səhifədə neçə element'), '50')
    expect(screen.getByTestId('pagination-summary')).toHaveTextContent('1–50 / 56')
  })

  it('axtarış nəticəni süzür və 1-ci səhifəyə qaytarır', async () => {
    renderPage(<MenuAdmin />)
    await screen.findByText('Yemək 1')
    await userEvent.click(screen.getByRole('button', { name: 'Səhifə 3' }))
    await userEvent.type(screen.getByPlaceholderText(/Məhsul axtar/), 'Yemək 5')
    // "Yemək 5", "Yemək 50".."Yemək 56" → 8 nəticə
    expect(screen.getByTestId('pagination-summary')).toHaveTextContent('1–8 / 8')
    expect(screen.queryByRole('button', { name: 'Növbəti səhifə' })).toBeNull()
    await userEvent.clear(screen.getByPlaceholderText(/Məhsul axtar/))
    await userEvent.type(screen.getByPlaceholderText(/Məhsul axtar/), 'yoxdur-belə-bir-şey')
    expect(screen.getByText('Axtarışa uyğun məhsul tapılmadı')).toBeInTheDocument()
    expect(screen.queryByTestId('pagination')).toBeNull()
  })
})

describe('CategoriesAdmin: kateqoriya siyahısı səhifələnir', () => {
  it('19 kateqoriya 10-10 göstərilir', async () => {
    renderPage(<CategoriesAdmin />)
    expect(await screen.findByText('Kateqoriya 1')).toBeInTheDocument()
    expect(screen.getByTestId('pagination-summary')).toHaveTextContent('1–10 / 19 kateqoriya')
    expect(screen.queryByText('Kateqoriya 11')).toBeNull()
    const nav = screen.getByRole('navigation', { name: 'Səhifələmə' })
    await userEvent.click(within(nav).getByRole('button', { name: 'Səhifə 2' }))
    expect(screen.getByText('Kateqoriya 19')).toBeInTheDocument()
    expect(screen.getByTestId('pagination-summary')).toHaveTextContent('11–19 / 19')
  })
})
