import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    notificationsApi: {
      list: vi.fn(),
      markRead: vi.fn().mockResolvedValue({}),
      setStatus: vi.fn(),
      remove: vi.fn().mockResolvedValue({}),
      clearRead: vi.fn().mockResolvedValue({}),
      markAllRead: vi.fn().mockResolvedValue({}),
    },
  }
})

import { notificationsApi } from '../lib/api'
import NotificationBell from '../admin/NotificationBell'
import { useNotificationStore } from '../store/notificationStore'

const n = (over) => ({ id: 1, type: 'call_waiter', status: 'OPEN', is_read: false, title: 'Masa 5 — Ofisiant çağırılır', created_at: new Date().toISOString(), entity_type: 'table', entity_id: 5, ...over })

async function openBell(items) {
  notificationsApi.list.mockResolvedValue(items)
  render(<MemoryRouter><NotificationBell /></MemoryRouter>)
  await userEvent.click(screen.getByRole('button', { name: 'Bildirişlər' }))
  await screen.findAllByTestId('notification-item')
}

beforeEach(() => {
  vi.clearAllMocks()
  useNotificationStore.setState({ items: [] })
})

describe('NotificationBell — Call Waiter / Request Bill', () => {
  it('açıq çağırışda "Qəbul et" və "Həll edildi" düymələri görünür; qəbul edəndə status və işçi göstərilir', async () => {
    notificationsApi.setStatus.mockResolvedValue(n({ status: 'ACCEPTED', is_read: true, handled_by_email: 'aysel@rest.az' }))
    await openBell([n()])
    const panel = screen.getByTestId('handle-panel')
    expect(within(panel).getByText('Gözləyir')).toBeInTheDocument()
    await userEvent.click(within(panel).getByRole('button', { name: 'Qəbul et' }))
    expect(notificationsApi.setStatus).toHaveBeenCalledWith(1, 'ACCEPTED')
    expect(await within(screen.getByTestId('handle-panel')).findByText(/Qəbul edildi · aysel/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Qəbul et' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Həll edildi' })).toBeInTheDocument()
  })

  it('"Həll edildi" sonrası düymələr yox olur', async () => {
    notificationsApi.setStatus.mockResolvedValue(n({ status: 'RESOLVED', is_read: true, handled_by_email: 'a@r.az' }))
    await openBell([n({ type: 'request_bill', title: 'Masa 3 — hesab istəyir' })])
    await userEvent.click(screen.getByRole('button', { name: 'Həll edildi' }))
    expect(await screen.findByText(/✓ Həll edildi/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Həll edildi' })).toBeNull()
  })

  it('həll olunmuş sorğuda düymə yoxdur, sifariş bildirişində status paneli heç yoxdur', async () => {
    await openBell([n({ id: 2, status: 'RESOLVED' }), n({ id: 3, type: 'order_created', title: 'Yeni sifariş', entity_type: 'order' })])
    expect(screen.getAllByTestId('handle-panel')).toHaveLength(1)
    expect(screen.queryByRole('button', { name: 'Qəbul et' })).toBeNull()
  })

  it('server rədd edərsə (başqası artıq həll edib) xəta göstərilir', async () => {
    notificationsApi.setStatus.mockRejectedValue({ response: { data: { error: 'Bu sorğu artıq həll olunub' } } })
    await openBell([n()])
    await userEvent.click(screen.getByRole('button', { name: 'Qəbul et' }))
    await vi.waitFor(() => expect(notificationsApi.setStatus).toHaveBeenCalled())
    expect(useNotificationStore.getState().items[0].status).toBe('OPEN')
  })

  it('socket yeniləməsi (başqa admin qəbul etdi) açıq siyahıda dərhal görünür', async () => {
    await openBell([n()])
    useNotificationStore.getState().replace(n({ status: 'ACCEPTED', handled_by_email: 'kamran@rest.az' }))
    expect(await screen.findByText(/Qəbul edildi · kamran/)).toBeInTheDocument()
  })

  it('gözləyən çağırış sayı başlıqda göstərilir', async () => {
    await openBell([n({ id: 1 }), n({ id: 2, status: 'ACCEPTED' }), n({ id: 3, status: 'RESOLVED' })])
    expect(screen.getByText('2 gözləyən çağırış')).toBeInTheDocument()
  })
})

describe('NotificationBell — növlər, filtr, müvəqqəti xəbərdarlıq', () => {
  const items = [
    n({ id: 1, type: 'out_of_stock', title: 'Məhsul bitib: Pasta', entity_type: 'product', status: 'OPEN' }),
    n({ id: 2, type: 'low_stock', title: 'Stok azalır: Salat', entity_type: 'product' }),
    n({ id: 3, type: 'system_error', title: 'Sistem xətası', entity_type: null, entity_id: null }),
    n({ id: 4, type: 'order_created', title: 'Yeni sifariş', entity_type: 'order' }),
  ]

  it('"Stok" filtri az qalan və bitən məhsul bildirişlərini, "Sistem" filtri sistem xətalarını göstərir', async () => {
    await openBell(items)
    await userEvent.click(screen.getByRole('button', { name: 'Stok' }))
    expect(screen.getAllByTestId('notification-item')).toHaveLength(2)
    expect(screen.getByText('Məhsul bitib: Pasta')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Sistem' }))
    expect(screen.getAllByTestId('notification-item')).toHaveLength(1)
    expect(screen.getByText('⚠️')).toBeInTheDocument()
  })

  it('müvəqqəti (mənfi ID-li) sistem xəbərdarlığı oxunanda/silinəndə serverə sorğu getmir', async () => {
    useNotificationStore.getState().push({ id: -123, type: 'system_error', title: 'Verilənlər bazası əlçatan deyil', status: 'OPEN', is_read: false, created_at: new Date().toISOString(), ephemeral: true })
    await useNotificationStore.getState().markRead(-123)
    expect(notificationsApi.markRead).not.toHaveBeenCalled()
    expect(useNotificationStore.getState().items[0].isRead).toBe(true)
    await useNotificationStore.getState().remove(-123)
    expect(notificationsApi.remove).not.toHaveBeenCalled()
    expect(useNotificationStore.getState().items).toHaveLength(0)
  })

  it('"Oxunmuşları sil" həll olunmamış çağırışı saxlayır', async () => {
    useNotificationStore.setState({
      items: [
        { ...n({ id: 1, status: 'ACCEPTED' }), isRead: true },
        { ...n({ id: 2, type: 'order_created', status: 'OPEN' }), isRead: true },
        { ...n({ id: 3, status: 'RESOLVED' }), isRead: true },
      ],
    })
    await useNotificationStore.getState().clearRead()
    expect(useNotificationStore.getState().items.map((x) => x.id)).toEqual([1])
  })
})
