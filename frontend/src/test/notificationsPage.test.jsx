import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    notificationsApi: {
      listPage: vi.fn(),
      markRead: vi.fn().mockResolvedValue({}),
      setStatus: vi.fn(),
      remove: vi.fn().mockResolvedValue({}),
      clearRead: vi.fn().mockResolvedValue({}),
      markAllRead: vi.fn().mockResolvedValue({}),
    },
  }
})

import { notificationsApi } from '../lib/api'
import NotificationsAdmin from '../admin/NotificationsAdmin'
import { useNotificationStore } from '../store/notificationStore'
import { useAuthStore } from '../store/authStore'
import { useSoundSettings, TONES, SOUND_TYPES } from '../lib/soundSettings'
import { playAlert, playTone } from '../lib/alerts'

const n = (over) => ({ id: 1, type: 'order_created', status: 'OPEN', is_read: false, title: 'Yeni sifariş', created_at: new Date().toISOString(), entity_type: 'order', entity_id: 7, ...over })

async function renderPage(items, hasMore = false, role = 'OWNER') {
  useAuthStore.setState({ admin: { id: 1, email: 'o@x.az', role } })
  notificationsApi.listPage.mockResolvedValue({ items, hasMore })
  render(<MemoryRouter><NotificationsAdmin /></MemoryRouter>)
  await screen.findAllByTestId('notification-row')
}

beforeEach(() => {
  vi.clearAllMocks()
  useNotificationStore.setState({ items: [], hasMore: false, loadingMore: false })
  useSoundSettings.setState({ enabled: true, volume: 0.6, tones: {} })
})

describe('NotificationsAdmin (bildirişlər səhifəsi)', () => {
  it('siyahı, oxunmamış və gözləyən çağırış sayı göstərilir; çağırışda Qəbul et/Həll edildi düymələri var', async () => {
    await renderPage([n({ id: 1 }), n({ id: 2, type: 'call_waiter', title: 'Masa 5 — Ofisiant çağırılır', entity_type: 'table' }), n({ id: 3, is_read: true })])
    expect(screen.getByTestId('notification-summary')).toHaveTextContent('2 oxunmamış')
    expect(screen.getByTestId('notification-summary')).toHaveTextContent('1 gözləyən çağırış')
    const panel = screen.getByTestId('handle-panel')
    expect(within(panel).getByRole('button', { name: 'Qəbul et' })).toBeInTheDocument()
  })

  it('filtr işləyir: "Ofisiant" yalnız çağırışları göstərir', async () => {
    await renderPage([n({ id: 1 }), n({ id: 2, type: 'call_waiter', title: 'Masa 5 — çağırış', entity_type: 'table' })])
    await userEvent.click(screen.getByRole('button', { name: 'Ofisiant' }))
    expect(screen.getAllByTestId('notification-row')).toHaveLength(1)
    expect(screen.getByText('Masa 5 — çağırış')).toBeInTheDocument()
  })

  it('"Daha köhnələri göstər" kursorla növbəti səhifəni gətirir və dublikat əlavə etmir', async () => {
    await renderPage([n({ id: 30 }), n({ id: 29 })], true)
    notificationsApi.listPage.mockResolvedValueOnce({ items: [n({ id: 29 }), n({ id: 28, title: 'Köhnə sifariş' })], hasMore: false })
    await userEvent.click(screen.getByRole('button', { name: 'Daha köhnələri göstər' }))
    expect(await screen.findByText('Köhnə sifariş')).toBeInTheDocument()
    expect(notificationsApi.listPage).toHaveBeenLastCalledWith({ limit: 50, before: 29 })
    expect(screen.getAllByTestId('notification-row')).toHaveLength(3)
    expect(screen.queryByRole('button', { name: 'Daha köhnələri göstər' })).toBeNull()
  })

  it('"Hamısını oxu" və silmə serverə gedir', async () => {
    await renderPage([n({ id: 1 }), n({ id: 2 })])
    await userEvent.click(screen.getByRole('button', { name: 'Hamısını oxu' }))
    expect(notificationsApi.markAllRead).toHaveBeenCalled()
    await userEvent.click(screen.getAllByRole('button', { name: 'Sil' })[0])
    expect(notificationsApi.remove).toHaveBeenCalledWith(1)
    expect(screen.getAllByTestId('notification-row')).toHaveLength(1)
  })

  it('ofisiant üçün "Sistem" filtri və sistem xətası səsi ayarı göstərilmir', async () => {
    await renderPage([n()], false, 'WAITER')
    expect(screen.queryByRole('button', { name: 'Sistem' })).toBeNull()
    expect(screen.queryByLabelText('Sistem xətası siqnalı')).toBeNull()
    expect(screen.getByLabelText('Yeni sifariş siqnalı')).toBeInTheDocument()
  })
})

describe('səs ayarları', () => {
  it('açar səsi söndürür/yandırır; söndürülübsə playAlert heç nə çalmır', async () => {
    await renderPage([n()])
    const toggle = screen.getByRole('switch', { name: 'Səsi aç/bağla' })
    expect(toggle).toHaveAttribute('aria-checked', 'true')
    await userEvent.click(toggle)
    expect(useSoundSettings.getState().enabled).toBe(false)
    expect(toggle).toHaveAttribute('aria-checked', 'false')
    expect(playAlert('order_created')).toBe(false)
  })

  it('növ üzrə siqnal seçimi və həcm yadda saxlanılır (localStorage)', async () => {
    await renderPage([n()])
    await userEvent.selectOptions(screen.getByLabelText('Yeni sifariş siqnalı'), 'alarm')
    expect(useSoundSettings.getState().toneFor('order_created')).toBe('alarm')
    expect(useSoundSettings.getState().toneFor('call_waiter')).toBe(SOUND_TYPES.call_waiter.tone)
    useSoundSettings.getState().setVolume(5)
    expect(useSoundSettings.getState().volume).toBe(1)
    expect(JSON.parse(localStorage.getItem('qrmenu_sound')).state).toMatchObject({ volume: 1, tones: { order_created: 'alarm' } })
  })

  it('"Səssiz" seçilən növ üçün siqnal çalınmır; AudioContext bloklanıbsa (jest yoxdur) çalmır, səhv atmır', () => {
    useSoundSettings.getState().setTone('call_waiter', 'off')
    expect(TONES.off.notes).toHaveLength(0)
    expect(playAlert('call_waiter')).toBe(false)
    expect(() => playTone('bell')).not.toThrow()
    expect(playTone('yoxdur')).toBe(false)
  })
})
