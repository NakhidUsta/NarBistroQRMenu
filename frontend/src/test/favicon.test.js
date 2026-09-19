import { describe, it, expect, beforeEach } from 'vitest'
import { applyFavicon } from '../lib/theme'

const icons = () => document.querySelectorAll('link[rel="icon"]')

beforeEach(() => {
  document.head.innerHTML = '<link rel="icon" type="image/svg+xml" href="/favicon.svg" />'
})

describe('applyFavicon', () => {
  it('mövcud ikon elementini yeniləyir (ikinci element yaratmır) və növü uzantıdan təyin edir', () => {
    applyFavicon('http://localhost:4000/uploads/m-1-thumb.webp')
    expect(icons()).toHaveLength(1)
    expect(icons()[0].getAttribute('href')).toBe('http://localhost:4000/uploads/m-1-thumb.webp')
    expect(icons()[0].type).toBe('image/webp')
    applyFavicon('/uploads/x.png?v=2')
    expect(icons()[0].type).toBe('image/png')
  })

  it('URL boşdursa standart ikona qayıdır', () => {
    applyFavicon('/uploads/x.png')
    applyFavicon(null)
    expect(icons()[0].getAttribute('href')).toBe('/favicon.svg')
    expect(icons()[0].type).toBe('image/svg+xml')
  })

  it('ikon elementi yoxdursa yaradır', () => {
    document.head.innerHTML = ''
    applyFavicon('/uploads/a.ico')
    expect(icons()).toHaveLength(1)
    expect(icons()[0].type).toBe('image/x-icon')
  })
})
