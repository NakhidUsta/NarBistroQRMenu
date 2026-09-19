import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ProductGallery from '../components/ProductGallery'
import AllergenChips from '../components/AllergenChips'
import ImageGalleryField from '../admin/ImageGalleryField'
import { useMenuStore } from '../store/menuStore'
import { useLocaleStore } from '../store/localeStore'
import { hidesProduct } from '../store/allergenFilterStore'

const ALLERGENS = [
  { id: 1, code: 'gluten', name: 'Qlüten', name_en: 'Gluten', name_ru: 'Глютен', icon: '🌾' },
  { id: 7, code: 'milk', name: 'Süd', name_en: 'Milk', name_ru: 'Молоко', icon: '🥛' },
]

beforeEach(() => {
  useLocaleStore.setState({ locale: 'az' })
  useMenuStore.setState({ allergens: ALLERGENS, products: [] })
})

describe('ProductGallery', () => {
  it('bir şəkildə nöqtələr göstərmir', () => {
    render(<ProductGallery images={['/uploads/a.jpg']} alt="Pasta" />)
    expect(screen.getAllByRole('img')).toHaveLength(1)
    expect(screen.queryByRole('tablist')).toBeNull()
  })

  it('çox şəkildə hər şəkil və naviqasiya nöqtələri render olunur', () => {
    render(<ProductGallery images={['/uploads/a.jpg', '/uploads/b.jpg', '/uploads/c.jpg']} alt="Pasta" />)
    expect(screen.getAllByRole('img')).toHaveLength(3)
    expect(screen.getAllByRole('tab')).toHaveLength(3)
    expect(screen.getAllByRole('tab')[0]).toHaveAttribute('aria-selected', 'true')
  })

  it('şəkil yoxdursa boş placeholder (sınıq şəkil yox)', () => {
    render(<ProductGallery images={[]} alt="Pasta" />)
    expect(screen.queryByRole('img')).toBeNull()
  })
})

describe('AllergenChips', () => {
  it('ID-lərə görə ikon + cari dildəki adı göstərir', () => {
    const { rerender } = render(<AllergenChips ids={[7, 1]} />)
    expect(screen.getByText('Qlüten')).toBeInTheDocument()
    expect(screen.getByText('Süd')).toBeInTheDocument()
    useLocaleStore.setState({ locale: 'ru' })
    rerender(<AllergenChips ids={[7, 1]} />)
    expect(screen.getByText('Молоко')).toBeInTheDocument()
  })

  it('naməlum/boş ID-lərdə heç nə render etmir', () => {
    const { container } = render(<AllergenChips ids={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('iconOnly rejimində ad title/aria-label-dədir', () => {
    render(<AllergenChips ids={[1]} iconOnly />)
    expect(screen.getByLabelText('Qlüten')).toHaveTextContent('🌾')
  })
})

describe('allergen filtri', () => {
  it('seçilən allergeni ehtiva edən yeməyi gizlədir, boş seçimdə heç nəyi', () => {
    expect(hidesProduct({ allergen_ids: [1, 7] }, [7])).toBe(true)
    expect(hidesProduct({ allergen_ids: [1] }, [7])).toBe(false)
    expect(hidesProduct({ allergen_ids: [1] }, [])).toBe(false)
    expect(hidesProduct({}, [7])).toBe(false)
  })
})

describe('menuStore.upsertProduct', () => {
  it('qismən yeniləmə (stok) qalereya və allergenləri silmir', () => {
    useMenuStore.setState({ products: [{ id: 5, name: 'Pasta', images: ['/uploads/a.jpg'], allergen_ids: [1], stock_quantity: 4 }] })
    useMenuStore.getState().upsertProduct({ id: 5, stock_quantity: 3 }, 'updated')
    expect(useMenuStore.getState().products[0]).toMatchObject({ images: ['/uploads/a.jpg'], allergen_ids: [1], stock_quantity: 3 })
  })

  it('tam yeniləmə qalereyanı əvəz edir', () => {
    useMenuStore.setState({ products: [{ id: 5, images: ['/uploads/a.jpg', '/uploads/b.jpg'] }] })
    useMenuStore.getState().upsertProduct({ id: 5, images: ['/uploads/b.jpg'] }, 'updated')
    expect(useMenuStore.getState().products[0].images).toEqual(['/uploads/b.jpg'])
  })
})

describe('ImageGalleryField (admin)', () => {
  it('sıralama: birinci şəkil "Əsas" olur, sağa/sola düymələri yerini dəyişir', async () => {
    const calls = []
    render(<ImageGalleryField value={['/uploads/a.jpg', '/uploads/b.jpg']} onChange={(v) => calls.push(v)} />)
    expect(screen.getByText('Əsas')).toBeInTheDocument()
    await userEvent.click(screen.getAllByLabelText('Sola')[1])
    expect(calls.at(-1)).toEqual(['/uploads/b.jpg', '/uploads/a.jpg'])
    await userEvent.click(screen.getAllByLabelText('Sil')[0])
    expect(calls.at(-1)).toEqual(['/uploads/b.jpg'])
  })

  it('10 şəkildən sonra əlavə etmə söndürülür', () => {
    const many = Array.from({ length: 10 }, (_, i) => `/uploads/${i}.jpg`)
    render(<ImageGalleryField value={many} onChange={() => {}} />)
    expect(screen.getByText('Kitabxanadan seç')).toBeDisabled()
  })
})
