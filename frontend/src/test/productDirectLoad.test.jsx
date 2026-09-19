import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import ProductDetail from '../pages/ProductDetail'
import { useMenuStore } from '../store/menuStore'
import { useLocaleStore } from '../store/localeStore'

const product = { id: 3, name: 'Pasta', price: 12, description: 'Dadlı', is_available: true, is_visible: true, ingredient_ids: [], images: [] }

// Regressiya: link birbaşa açılanda məhsul əvvəlcə yoxdur, sonra menyu yüklənir. Hook-ların sayı dəyişməməlidir
// ("Rendered more hooks than during the previous render" səhifəni çökdürürdü).
describe('ProductDetail — birbaşa link', () => {
  beforeEach(() => {
    useLocaleStore.setState({ locale: 'az' })
    useMenuStore.setState({ products: [], ingredients: [], status: 'loading' })
  })

  it('menyu gec yüklənəndə çökmür: əvvəl "...", sonra məhsul', () => {
    render(
      <MemoryRouter initialEntries={['/product/3']}>
        <Routes><Route path="/product/:id" element={<ProductDetail />} /></Routes>
      </MemoryRouter>,
    )
    expect(screen.getByTestId('product-missing')).toHaveTextContent('...')
    act(() => useMenuStore.setState({ products: [product], status: 'ready' }))
    expect(screen.queryByTestId('product-missing')).toBeNull()
    expect(screen.getByText('Pasta')).toBeInTheDocument()
  })

  it('menyu yüklənib, məhsul yoxdursa izahat və menyuya qayıdış göstərilir', () => {
    useMenuStore.setState({ products: [], status: 'ready' })
    render(
      <MemoryRouter initialEntries={['/product/99']}>
        <Routes><Route path="/product/:id" element={<ProductDetail />} /></Routes>
      </MemoryRouter>,
    )
    expect(screen.getByRole('link')).toHaveAttribute('href', '/menyu')
  })
})
