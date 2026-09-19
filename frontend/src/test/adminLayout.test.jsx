import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

vi.mock('../lib/useAdminSocket', () => ({ useAdminSocket: () => 'connected' }))
vi.mock('../admin/NotificationBell', () => ({ default: () => <span>bell</span> }))
vi.mock('../lib/alerts', () => ({ requestNotificationPermission: vi.fn(), installAudioUnlock: vi.fn(), playAlert: vi.fn(), browserNotify: vi.fn() }))

import AdminLayout from '../admin/AdminLayout'
import { useAuthStore } from '../store/authStore'

function renderLayout(path = '/admin/orders') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/admin" element={<AdminLayout />}>
          <Route path="orders" element={<p>orders page</p>} />
          <Route path="menu" element={<p>menu page</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => useAuthStore.setState({ admin: { id: 1, email: 'o@x.az', role: 'OWNER' } }))

describe('AdminLayout (mobil çəkməcə)', () => {
  it('hamburger düyməsi çəkməcəni açıb-bağlayır (aria-expanded)', async () => {
    renderLayout()
    const toggle = screen.getByRole('button', { name: 'Menyu' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(document.getElementById('admin-sidebar').className).toContain('-translate-x-full')
    await userEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(document.getElementById('admin-sidebar').className).not.toContain('-translate-x-full')
    await userEvent.keyboard('{Escape}')
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
  })

  it('naviqasiya edəndə çəkməcə bağlanır', async () => {
    renderLayout()
    await userEvent.click(screen.getByRole('button', { name: 'Menyu' }))
    await userEvent.click(screen.getByRole('link', { name: /Menyu$/ }))
    expect(screen.getByText('menu page')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Menyu' })).toHaveAttribute('aria-expanded', 'false')
  })

  it('rola görə naviqasiya: KITCHEN yalnız sifariş/mətbəx/hesab görür', () => {
    useAuthStore.setState({ admin: { id: 4, email: 'k@x.az', role: 'KITCHEN' } })
    renderLayout()
    expect(screen.queryByRole('link', { name: /Promosyonlar/ })).toBeNull()
    expect(screen.getByRole('link', { name: /Sifarişlər/ })).toBeInTheDocument()
  })
})
