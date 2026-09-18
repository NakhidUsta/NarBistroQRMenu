import { describe, it, expect, beforeEach } from 'vitest'
import { useCartStore } from '../store/cartStore'
import { useFavoritesStore } from '../store/favoritesStore'
import { useLocaleStore } from '../store/localeStore'
import { t } from '../lib/i18n'
import { applyTheme, resetTheme, parseTheme } from '../lib/theme'

const pasta = { id: 1, name: 'Pasta', price: 24, image_url: '' }

describe('cartStore', () => {
  beforeEach(() => useCartStore.setState({ items: [] }))

  it('eyni məhsulu təkrar əlavə edəndə miqdarları birləşdirir', () => {
    useCartStore.getState().addItem(pasta, 1)
    useCartStore.getState().addItem(pasta, 2)
    expect(useCartStore.getState().items).toHaveLength(1)
    expect(useCartStore.getState().items[0].quantity).toBe(3)
  })

  it('miqdar 0-a düşəndə məhsulu silir', () => {
    useCartStore.getState().addItem(pasta, 1)
    useCartStore.getState().updateQuantity(1, 0)
    expect(useCartStore.getState().items).toEqual([])
  })

  it('syncPrices yalnız qiymət dəyişibsə true qaytarır və qiyməti yeniləyir', () => {
    useCartStore.getState().addItem(pasta, 1)
    expect(useCartStore.getState().syncPrices([{ id: 1, price: 24 }])).toBe(false)
    expect(useCartStore.getState().syncPrices([{ id: 1, price: '27.50' }])).toBe(true)
    expect(useCartStore.getState().items[0].price).toBe(27.5)
  })

  it('removeMany seçilmiş məhsulları çıxarır', () => {
    useCartStore.getState().addItem(pasta, 1)
    useCartStore.getState().addItem({ ...pasta, id: 2 }, 1)
    useCartStore.getState().removeMany([1])
    expect(useCartStore.getState().items.map((i) => i.product_id)).toEqual([2])
  })

  it('yalnız items localStorage-də saxlanılır (səhifə yenilənəndə səbət itmir)', () => {
    useCartStore.getState().addItem(pasta, 2)
    const saved = JSON.parse(localStorage.getItem('qrmenu_cart'))
    expect(Object.keys(saved.state)).toEqual(['items'])
    expect(saved.state.items[0].quantity).toBe(2)
  })
})

describe('favoritesStore', () => {
  it('toggle əlavə edir və çıxarır', () => {
    useFavoritesStore.setState({ ids: [] })
    useFavoritesStore.getState().toggle(5)
    expect(useFavoritesStore.getState().ids).toEqual([5])
    useFavoritesStore.getState().toggle(5)
    expect(useFavoritesStore.getState().ids).toEqual([])
  })
})

describe('i18n', () => {
  it('seçilmiş dilə görə tərcümə qaytarır', () => {
    useLocaleStore.setState({ locale: 'en' })
    expect(t('call_waiter')).toBe('Call waiter')
    useLocaleStore.setState({ locale: 'ru' })
    expect(t('call_waiter')).toBe('Позвать официанта')
    useLocaleStore.setState({ locale: 'az' })
    expect(t('call_waiter')).toBe('Ofisiant çağır')
  })

  it('naməlum açar açarın özünü qaytarır (boş ekran yox)', () => {
    expect(t('yoxdur_bele_acar')).toBe('yoxdur_bele_acar')
  })

  it('bütün dillərdə eyni açarlar var', async () => {
    const mod = await import('../lib/i18n.js?raw')
    const src = mod.default
    const keysOf = (lang) => {
      const start = src.indexOf(`  ${lang}: {`)
      const end = src.indexOf('\n  },', start)
      return [...src.slice(start, end).matchAll(/^\s{4}(\w+):/gm)].map((m) => m[1]).sort()
    }
    expect(keysOf('en')).toEqual(keysOf('az'))
    expect(keysOf('ru')).toEqual(keysOf('az'))
  })
})

describe('theme', () => {
  it('parseTheme xarab JSON-da boş obyekt qaytarır', () => {
    expect(parseTheme('{bad')).toEqual({})
    expect(parseTheme(null)).toEqual({})
  })

  it('applyTheme CSS dəyişənlərini təyin edir, resetTheme silir', () => {
    applyTheme(JSON.stringify({ primary: '#112233', background: '#ffffff' }))
    const root = document.documentElement.style
    expect(root.getPropertyValue('--color-burgundy')).toBe('#112233')
    expect(root.getPropertyValue('--color-cream')).toBe('#ffffff')
    resetTheme()
    expect(root.getPropertyValue('--color-burgundy')).toBe('')
  })
})
