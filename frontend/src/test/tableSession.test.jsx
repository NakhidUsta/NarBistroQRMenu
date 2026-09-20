import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, tablesApi: { scan: vi.fn().mockResolvedValue({ code: 'table_001', label: 'Masa 1' }) } }
})

import { useTableSessionStore } from '../store/tableSessionStore'

beforeEach(() => {
  useTableSessionStore.setState({ table: null })
  sessionStorage.clear()
  localStorage.clear()
})

describe('masa sessiyası: yalnız QR ilə açılışda', () => {
  it('QR skanından sonra masa səhifə sessiyasında (sessionStorage) saxlanılır, localStorage-də yox', async () => {
    await useTableSessionStore.getState().scan('table_001', 'tok')
    expect(useTableSessionStore.getState().table).toEqual({ code: 'table_001', label: 'Masa 1', token: 'tok' })
    expect(JSON.parse(sessionStorage.getItem('qrmenu_table_session')).state.table.code).toBe('table_001')
    expect(localStorage.getItem('qrmenu_table_session')).toBeNull()
  })

  it('adi linklə (yeni açılış) masa yoxdur: köhnə localStorage masası yüklənmir və silinir', async () => {
    localStorage.setItem('qrmenu_table_session', JSON.stringify({ state: { table: { code: 'table_009', label: 'Masa 9' } }, version: 0 }))
    vi.resetModules()
    const { useTableSessionStore: fresh } = await import('../store/tableSessionStore')
    expect(fresh.getState().table).toBeNull()
    expect(localStorage.getItem('qrmenu_table_session')).toBeNull()
  })

  it('yeni açılışda sessionStorage boşdursa masa null-dur; eyni tabda yeniləmə masanı saxlayır', async () => {
    sessionStorage.setItem('qrmenu_table_session', JSON.stringify({ state: { table: { code: 'table_002', label: 'Masa 2' } }, version: 0 }))
    vi.resetModules()
    const { useTableSessionStore: reloaded } = await import('../store/tableSessionStore')
    expect(reloaded.getState().table).toEqual({ code: 'table_002', label: 'Masa 2' })
    sessionStorage.clear()
    vi.resetModules()
    const { useTableSessionStore: newTab } = await import('../store/tableSessionStore')
    expect(newTab.getState().table).toBeNull()
  })
})
