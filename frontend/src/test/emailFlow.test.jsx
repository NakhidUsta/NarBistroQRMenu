import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    authApi: {
      config: vi.fn(), login: vi.fn(), forgotPassword: vi.fn(), resetPassword: vi.fn(), verifyEmail: vi.fn(),
      sendVerification: vi.fn(), testMail: vi.fn(), sessions: vi.fn().mockResolvedValue([]), revokeSession: vi.fn(),
      changePassword: vi.fn(), changeEmail: vi.fn(), logoutAll: vi.fn(), me: vi.fn(), logout: vi.fn(), refresh: vi.fn(),
    },
  }
})

import { authApi } from '../lib/api'
import Login from '../admin/Login'
import ForgotPassword from '../admin/ForgotPassword'
import ResetPassword from '../admin/ResetPassword'
import VerifyEmail from '../admin/VerifyEmail'
import AccountAdmin from '../admin/AccountAdmin'
import { useAuthStore } from '../store/authStore'
import { useUiStore } from '../store/uiStore'

const httpError = (status, error) => Object.assign(new Error('x'), { response: { status, data: { error } } })
const at = (path, element, route = path.split('?')[0]) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={route} element={element} />
        <Route path="/admin/login" element={<p>giriş səhifəsi</p>} />
        <Route path="/admin/forgot-password" element={<p>unutdum səhifəsi</p>} />
      </Routes>
    </MemoryRouter>,
  )
const toasts = () => useUiStore.getState().toasts.map((t) => t.message)

beforeEach(() => {
  vi.clearAllMocks()
  authApi.sessions.mockResolvedValue([])
  useUiStore.setState({ toasts: [] })
  useAuthStore.setState({ admin: null })
})

describe('Login: "Şifrəni unutdunuz?"', () => {
  it('link HƏMİŞƏ görünür (e-poçt xidməti qurulub-qurulmamasından asılı olmayaraq) və unutdum səhifəsinə aparır', () => {
    at('/admin/login', <Login />)
    const link = screen.getByRole('link', { name: 'Şifrəni unutdunuz?' })
    expect(link).toHaveAttribute('href', '/admin/forgot-password')
    expect(screen.getByRole('button', { name: 'Daxil ol' })).toBeEnabled()
  })
})

describe('ForgotPassword', () => {
  beforeEach(() => authApi.config.mockResolvedValue({ password_reset: true }))

  it('e-poçt xidməti qurulmayıbsa izahat göstərilir və göndərmə düyməsi bağlıdır', async () => {
    authApi.config.mockResolvedValue({ password_reset: false })
    at('/admin/forgot-password', <ForgotPassword />)
    expect(await screen.findByTestId('mail-unavailable')).toHaveTextContent('E-poçt xidməti hələ qurulmayıb')
    expect(screen.getByRole('button', { name: 'Sıfırlama linki göndər' })).toBeDisabled()
  })

  it('xidmət qurulubsa izahat yoxdur, düymə aktivdir; config alınmasa da (offline) forma işləyir', async () => {
    at('/admin/forgot-password', <ForgotPassword />)
    await waitFor(() => expect(authApi.config).toHaveBeenCalled())
    expect(screen.queryByTestId('mail-unavailable')).toBeNull()
    expect(screen.getByRole('button', { name: 'Sıfırlama linki göndər' })).toBeEnabled()
  })

  it('e-poçt göndərir və serverin (hesabı açıqlamayan) mesajını göstərir', async () => {
    authApi.forgotPassword.mockResolvedValue({ message: 'Bu e-poçt ünvanı qeydiyyatlıdırsa, link göndərildi.' })
    at('/admin/forgot-password', <ForgotPassword />)
    await userEvent.type(screen.getByLabelText('E-poçt'), '  owner@savora.az ')
    await userEvent.click(screen.getByRole('button', { name: 'Sıfırlama linki göndər' }))
    expect(authApi.forgotPassword).toHaveBeenCalledWith('owner@savora.az')
    expect(await screen.findByRole('status')).toHaveTextContent('qeydiyyatlıdırsa')
    expect(screen.queryByLabelText('E-poçt')).toBeNull()
  })

  it('xətada (məs. limit) səbəb göstərilir və forma qalır', async () => {
    authApi.forgotPassword.mockRejectedValue(httpError(429, 'Çox sayda sorğu göndərildi, 15 dəqiqə sonra yenidən cəhd edin'))
    at('/admin/forgot-password', <ForgotPassword />)
    await userEvent.type(screen.getByLabelText('E-poçt'), 'a@b.az')
    await userEvent.click(screen.getByRole('button', { name: 'Sıfırlama linki göndər' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Çox sayda sorğu')
    expect(screen.getByLabelText('E-poçt')).toBeInTheDocument()
  })
})

describe('ResetPassword', () => {
  const fill = async (a, b) => {
    await userEvent.type(screen.getByLabelText('Yeni şifrə'), a)
    await userEvent.type(screen.getByLabelText('Yeni şifrə (təkrar)'), b)
    await userEvent.click(screen.getByRole('button', { name: 'Şifrəni dəyiş' }))
  }

  it('token yoxdursa forma yox, "yeni link tələb et" göstərilir', () => {
    at('/admin/reset-password', <ResetPassword />)
    expect(screen.getByRole('alert')).toHaveTextContent('yarımçıqdır')
    expect(screen.getByRole('link', { name: 'Yeni link tələb et' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Yeni şifrə')).toBeNull()
  })

  it('şifrələr uyğun gəlmirsə serverə sorğu getmir', async () => {
    at('/admin/reset-password?token=abc', <ResetPassword />)
    await fill('YeniSifre123', 'BaskaSifre123')
    expect(screen.getByRole('alert')).toHaveTextContent('uyğun gəlmir')
    expect(authApi.resetPassword).not.toHaveBeenCalled()
  })

  it('uğurlu: tokeni və yeni şifrəni göndərir, "daxil ol" düyməsi çıxır', async () => {
    authApi.resetPassword.mockResolvedValue({ message: 'ok' })
    at('/admin/reset-password?token=t0k%2Fen', <ResetPassword />)
    await fill('YeniSifre123', 'YeniSifre123')
    expect(authApi.resetPassword).toHaveBeenCalledWith('t0k/en', 'YeniSifre123') // URL-də kodlanmış token düzgün açılır
    expect(await screen.findByRole('status')).toHaveTextContent('Şifrə dəyişdirildi')
    expect(screen.getByRole('link', { name: 'Daxil ol' })).toHaveAttribute('href', '/admin/login')
  })

  it('bitmiş/etibarsız linkdə xəta və yeni link təklifi göstərilir', async () => {
    authApi.resetPassword.mockRejectedValue(httpError(400, 'Link etibarsızdır və ya vaxtı bitib — yenisini tələb edin'))
    at('/admin/reset-password?token=old', <ResetPassword />)
    await fill('YeniSifre123', 'YeniSifre123')
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('vaxtı bitib')
    expect(alert.querySelector('a')).toHaveAttribute('href', '/admin/forgot-password')
  })
})

describe('VerifyEmail', () => {
  it('token avtomatik və YALNIZ BİR dəfə göndərilir; uğurda təsdiq mesajı və açıq sessiyanın statusu yenilənir', async () => {
    authApi.verifyEmail.mockResolvedValue({ message: 'ok' })
    useAuthStore.setState({ admin: { id: 1, email: 'o@x.az', role: 'OWNER', email_verified: false } })
    at('/admin/verify-email?token=verif', <VerifyEmail />)
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('təsdiqləndi'))
    expect(authApi.verifyEmail).toHaveBeenCalledTimes(1)
    expect(authApi.verifyEmail).toHaveBeenCalledWith('verif')
    expect(useAuthStore.getState().admin.email_verified).toBe(true)
  })

  it('etibarsız linkdə xəta göstərilir; token yoxdursa sorğu getmir', async () => {
    authApi.verifyEmail.mockRejectedValue(httpError(400, 'Link etibarsızdır və ya vaxtı bitib — yenisini tələb edin'))
    const { unmount } = at('/admin/verify-email?token=bad', <VerifyEmail />)
    expect(await screen.findByRole('alert')).toHaveTextContent('etibarsızdır')
    unmount()
    vi.clearAllMocks()
    at('/admin/verify-email', <VerifyEmail />)
    expect(screen.getByRole('alert')).toHaveTextContent('yarımçıqdır')
    expect(authApi.verifyEmail).not.toHaveBeenCalled()
  })
})

describe('AccountAdmin: e-poçt bölməsi', () => {
  const renderAccount = (admin) => {
    useAuthStore.setState({ admin })
    return render(<MemoryRouter><AccountAdmin /></MemoryRouter>)
  }

  it('təsdiqlənməmiş hesab: status və "Təsdiq məktubu göndər" düyməsi; klikdə server mesajı göstərilir', async () => {
    authApi.sendVerification.mockResolvedValue({ message: 'Təsdiq məktubu göndərildi — e-poçtunuzu yoxlayın.' })
    renderAccount({ id: 2, email: 'm@x.az', role: 'MANAGER', email_verified: false })
    const section = screen.getByTestId('email-section')
    expect(section).toHaveTextContent('təsdiqlənməyib')
    expect(screen.queryByRole('button', { name: /Sınaq məktubu/ })).toBeNull() // OWNER deyil
    await userEvent.click(screen.getByRole('button', { name: 'Təsdiq məktubu göndər' }))
    await waitFor(() => expect(toasts()).toContain('Təsdiq məktubu göndərildi — e-poçtunuzu yoxlayın.'))
  })

  it('təsdiqlənmiş hesab: "✓ təsdiqlənib", təsdiq düyməsi yoxdur', () => {
    renderAccount({ id: 2, email: 'm@x.az', role: 'MANAGER', email_verified: true })
    expect(screen.getByTestId('email-section')).toHaveTextContent('✓ təsdiqlənib')
    expect(screen.queryByRole('button', { name: 'Təsdiq məktubu göndər' })).toBeNull()
  })

  it('OWNER "Sınaq məktubu" ilə SMTP-ni yoxlayır; Gmail xətası səbəbi ilə göstərilir', async () => {
    authApi.testMail.mockRejectedValue(httpError(502, 'Gmail girişi qəbul olunmadı — şifrə Google "Tətbiq şifrəsi" olmalıdır'))
    renderAccount({ id: 1, email: 'o@x.az', role: 'OWNER', email_verified: true })
    await userEvent.click(screen.getByRole('button', { name: /Sınaq məktubu göndər/ }))
    await waitFor(() => expect(toasts().some((m) => m.includes('Tətbiq şifrəsi'))).toBe(true))
    expect(useUiStore.getState().toasts.at(-1).variant).toBe('error')
  })
})

describe('AccountAdmin: e-poçtu dəyiş', () => {
  beforeEach(() => {
    useAuthStore.setState({ admin: { id: 1, email: 'admin@qrmenu.local', role: 'OWNER', email_verified: false }, fetchMe: vi.fn().mockResolvedValue() })
  })

  it('yeni e-poçt və cari şifrə serverə göndərilir, uğur mesajı göstərilir, sahələr təmizlənir', async () => {
    authApi.changeEmail.mockResolvedValue({ email: 'yeni@gmail.com', message: 'E-poçt dəyişdirildi. Yeni ünvana təsdiq məktubu göndərildi — linkə basıb təsdiqləyin.' })
    at('/admin/account', <AccountAdmin />)
    const form = await screen.findByTestId('change-email-form')
    await userEvent.type(form.querySelector('input[type=email]'), 'yeni@gmail.com')
    await userEvent.type(form.querySelector('input[type=password]'), 'CariSifre123')
    await userEvent.click(within(form).getByRole('button', { name: 'E-poçtu dəyiş' }))
    await waitFor(() => expect(authApi.changeEmail).toHaveBeenCalledWith('yeni@gmail.com', 'CariSifre123'))
    await waitFor(() => expect(toasts().join(' ')).toContain('təsdiq məktubu göndərildi'))
    expect(form.querySelector('input[type=email]')).toHaveValue('')
  })

  it('yanlış şifrədə serverin xətası göstərilir', async () => {
    authApi.changeEmail.mockRejectedValue(httpError(400, 'Cari şifrə yanlışdır'))
    at('/admin/account', <AccountAdmin />)
    const form = await screen.findByTestId('change-email-form')
    await userEvent.type(form.querySelector('input[type=email]'), 'yeni@gmail.com')
    await userEvent.type(form.querySelector('input[type=password]'), 'yanlis')
    await userEvent.click(within(form).getByRole('button', { name: 'E-poçtu dəyiş' }))
    await waitFor(() => expect(toasts()).toContain('Cari şifrə yanlışdır'))
  })
})
