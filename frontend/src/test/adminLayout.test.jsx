import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

vi.mock('../lib/useAdminSocket', () => ({ useAdminSocket: () => 'connected' }))
vi.mock('../admin/NotificationBell', () => ({ default: () => <span>bell</span> }))
// `let` ilə: hər testdə audio vəziyyətini dəyişə bilmək üçün (defolt: "running", bloklanma testində "suspended")
let mockAudioState = { state: 'running' }
vi.mock('../lib/alerts', () => ({
  requestNotificationPermission: vi.fn(), installAudioUnlock: vi.fn(), playAlert: vi.fn(), browserNotify: vi.fn(),
  unlockAudio: vi.fn().mockResolvedValue(true), previewTone: vi.fn().mockResolvedValue(true),
  useAudioState: Object.assign((sel) => sel(mockAudioState), { getState: () => mockAudioState }),
}))

import AdminLayout from '../admin/AdminLayout'
import { useAuthStore } from '../store/authStore'
import { unlockAudio } from '../lib/alerts'

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

beforeEach(() => {
  useAuthStore.setState({ admin: { id: 1, email: 'o@x.az', role: 'OWNER' } })
  mockAudioState = { state: 'running' }
})

// QA (istifadəçi bildirişi): "bildirişlərin səsi gəlmir" — səbəb brauzerin AudioContext-i jestsiz "suspended" saxlaması idi;
// xəbərdarlıq əvvəllər yalnız Bildirişlər səhifəsində idi, admin başqa səhifədə səssiz qalırdı. İndi hər admin səhifəsində göstərilir.
describe('AdminLayout: səs bloklanma xəbərdarlığı', () => {
  it('audio "suspended"-dirsə (və səs aktivdirsə) bütün admin səhifələrində xəbərdarlıq göstərilir, "Aktivləşdir" unlockAudio çağırır', async () => {
    mockAudioState = { state: 'suspended' }
    renderLayout('/admin/orders')
    const warning = screen.getByTestId('sound-blocked-warning')
    expect(warning).toHaveTextContent('Brauzer bildiriş səsini bloklayıb')
    await userEvent.click(screen.getByRole('button', { name: /Səsi aktivləşdir/ }))
    expect(unlockAudio).toHaveBeenCalled()
  })

  it('audio "running"-dirsə xəbərdarlıq yoxdur', () => {
    renderLayout('/admin/orders')
    expect(screen.queryByTestId('sound-blocked-warning')).not.toBeInTheDocument()
  })

  it('KITCHEN rolunda (səs ayarı olmayan rol) "suspended" olsa belə xəbərdarlıq göstərilmir', () => {
    mockAudioState = { state: 'suspended' }
    useAuthStore.setState({ admin: { id: 4, email: 'k@x.az', role: 'KITCHEN' } })
    renderLayout('/admin/orders')
    expect(screen.queryByTestId('sound-blocked-warning')).not.toBeInTheDocument()
  })
})

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

describe('AdminLayout: defolt şifrə xəbərdarlığı (QA F1)', () => {
  it('hesab məlum defolt şifrədədirsə (default_password) qırmızı xəbərdarlıq və "Şifrəni dəyiş" linki göstərilir', () => {
    useAuthStore.setState({ admin: { id: 1, email: 'o@x.az', role: 'OWNER', default_password: true } })
    renderLayout()
    const warning = screen.getByTestId('default-password-warning')
    expect(warning).toHaveTextContent('defolt şifrədədir')
    expect(screen.getByRole('link', { name: /Şifrəni dəyiş/ })).toHaveAttribute('href', '/admin/account')
  })

  it('bayraq yoxdursa (güclü şifrə) xəbərdarlıq göstərilmir', () => {
    renderLayout()
    expect(screen.queryByTestId('default-password-warning')).toBeNull()
  })
})
