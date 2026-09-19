import { describe, it, expect, vi, afterEach } from 'vitest'
import { shareLink, publicUrl } from '../lib/share'

const payload = { title: 'Pasta', text: 'Pasta — 18.00 ₼', url: 'https://menu.az/product/7' }

afterEach(() => {
  delete navigator.share
  delete navigator.clipboard
})

describe('shareLink', () => {
  it('navigator.share varsa sistem paylaşım pəncərəsini açır', async () => {
    navigator.share = vi.fn().mockResolvedValue()
    expect(await shareLink(payload)).toBe('shared')
    expect(navigator.share).toHaveBeenCalledWith(payload)
  })

  it('istifadəçi ləğv edərsə kopyalamağa keçmir', async () => {
    navigator.share = vi.fn().mockRejectedValue(Object.assign(new Error('x'), { name: 'AbortError' }))
    const writeText = vi.fn()
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    expect(await shareLink(payload)).toBe('cancelled')
    expect(writeText).not.toHaveBeenCalled()
  })

  it('share yoxdursa linki kopyalayır', async () => {
    const writeText = vi.fn().mockResolvedValue()
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    expect(await shareLink(payload)).toBe('copied')
    expect(writeText).toHaveBeenCalledWith(payload.url)
  })

  it('share xəta verərsə kopyalama ehtiyatı işləyir; hamısı uğursuzdursa "failed"', async () => {
    navigator.share = vi.fn().mockRejectedValue(new Error('NotAllowed'))
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn().mockResolvedValue() }, configurable: true })
    expect(await shareLink(payload)).toBe('copied')
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) }, configurable: true })
    expect(await shareLink(payload)).toBe('failed')
  })

  it('paylaşılan link masa kodu (?table=) daşımır', () => {
    window.history.pushState({}, '', '/menyu?table=table_001&t=secrettoken')
    expect(publicUrl('/product/7')).toBe(`${window.location.origin}/product/7`)
    expect(publicUrl('/product/7')).not.toContain('table')
  })
})
