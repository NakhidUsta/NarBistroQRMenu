import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { InstagramBioLink } from '../admin/Settings'
import { useRestaurantStore } from '../store/restaurantStore'
import { useUiStore } from '../store/uiStore'

const toasts = () => useUiStore.getState().toasts.map((t) => t.message)

beforeEach(() => {
  useUiStore.setState({ toasts: [] })
  useRestaurantStore.setState({ restaurant: { name: 'Savora' } })
})
afterEach(() => {
  delete navigator.share
  delete navigator.clipboard
})

describe('Admin: Instagram bio linki (PDF 2.12)', () => {
  it('ümumi /menyu linki göstərilir (masa parametri yoxdur)', () => {
    render(<InstagramBioLink />)
    expect(screen.getByDisplayValue(`${window.location.origin}/menyu`)).toBeInTheDocument()
  })

  it('[Linki kopyala] clipboard-a yazır', async () => {
    const writeText = vi.fn().mockResolvedValue()
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    render(<InstagramBioLink />)
    await userEvent.click(screen.getByRole('button', { name: 'Linki kopyala' }))
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/menyu`)
    expect(toasts()).toContain('Link kopyalandı')
  })

  it('clipboard işləməsə səssiz yox, xəta bildirişi göstərilir', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) }, configurable: true })
    render(<InstagramBioLink />)
    await userEvent.click(screen.getByRole('button', { name: 'Linki kopyala' }))
    expect(toasts().some((m) => m.includes('Kopyalamaq mümkün olmadı'))).toBe(true)
  })

  it('[Instagram-da paylaş] mobildə sistem paylaşım pəncərəsini restoran adı ilə açır', async () => {
    navigator.share = vi.fn().mockResolvedValue()
    render(<InstagramBioLink />)
    await userEvent.click(screen.getByRole('button', { name: 'Instagram-da paylaş' }))
    expect(navigator.share).toHaveBeenCalledWith(expect.objectContaining({ title: 'Savora', url: `${window.location.origin}/menyu` }))
  })

  it('paylaşım dəstəklənmirsə linki kopyalayır və izah edir', async () => {
    const writeText = vi.fn().mockResolvedValue()
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    render(<InstagramBioLink />)
    await userEvent.click(screen.getByRole('button', { name: 'Instagram-da paylaş' }))
    expect(writeText).toHaveBeenCalled()
    expect(toasts().some((m) => m.includes('Instagram bio'))).toBe(true)
  })
})
