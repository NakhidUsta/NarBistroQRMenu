import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, tablesApi: { scan: vi.fn(), callWaiter: vi.fn(), requestBill: vi.fn() } }
})

import { tablesApi } from '../lib/api'
import TableActions from '../components/TableActions'
import { useTableSessionStore } from '../store/tableSessionStore'
import { useUiStore } from '../store/uiStore'
import { useLocaleStore } from '../store/localeStore'

const toasts = () => useUiStore.getState().toasts.map((t) => t.message)

beforeEach(() => {
  vi.clearAllMocks()
  useLocaleStore.setState({ locale: 'az' })
  useUiStore.setState({ toasts: [] })
  useTableSessionStore.setState({ table: { code: 'table_005', label: 'Masa 5', token: 'qr-token-123' } })
})

describe('TableActions: QR tokeni ilə çağırış', () => {
  it('"Ofisiant çağır" və "Hesab istə" masa kodu ilə BİRLİKDƏ QR tokenini göndərir', async () => {
    tablesApi.callWaiter.mockResolvedValue({})
    tablesApi.requestBill.mockResolvedValue({})
    render(<TableActions />)
    await userEvent.click(screen.getByRole('button', { name: /Ofisiant çağır/ }))
    await waitFor(() => expect(tablesApi.callWaiter).toHaveBeenCalledWith('table_005', 'qr-token-123'))
    await userEvent.click(screen.getByRole('button', { name: /Hesab istə/ }))
    await waitFor(() => expect(tablesApi.requestBill).toHaveBeenCalledWith('table_005', 'qr-token-123'))
  })

  it('server 403 qaytarsa (köhnə/etibarsız QR) müştəriyə "QR kodu yenidən oxudun" deyilir', async () => {
    tablesApi.callWaiter.mockRejectedValue({ response: { status: 403 } })
    render(<TableActions />)
    await userEvent.click(screen.getByRole('button', { name: /Ofisiant çağır/ }))
    await waitFor(() => expect(toasts()).toContain('Masadakı QR kodu yenidən oxudun'))
  })

  it('digər xətada ümumi mesaj göstərilir; masa yoxdursa (adi link) düymələr də yoxdur', async () => {
    tablesApi.callWaiter.mockRejectedValue({ response: { status: 500 } })
    const { unmount } = render(<TableActions />)
    await userEvent.click(screen.getByRole('button', { name: /Ofisiant çağır/ }))
    await waitFor(() => expect(toasts().length).toBeGreaterThan(0))
    expect(toasts()).not.toContain('Masadakı QR kodu yenidən oxudun')
    unmount()
    useTableSessionStore.setState({ table: null })
    render(<TableActions />)
    expect(screen.queryByRole('button', { name: /Ofisiant çağır/ })).toBeNull()
  })

  it('QR skanı tokeni sessiyada saxlayır (yalnız sessionStorage-də, localStorage-də yox)', async () => {
    tablesApi.scan.mockResolvedValue({ code: 'table_009', label: 'Masa 9' })
    useTableSessionStore.setState({ table: null })
    await useTableSessionStore.getState().scan('table_009', 'scan-token')
    expect(useTableSessionStore.getState().table).toEqual({ code: 'table_009', label: 'Masa 9', token: 'scan-token' })
    expect(sessionStorage.getItem('qrmenu_table_session')).toContain('scan-token')
    expect(localStorage.getItem('qrmenu_table_session')).toBeNull()
  })
})
