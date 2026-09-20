import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, mailSettingsApi: { get: vi.fn(), save: vi.fn(), remove: vi.fn(), test: vi.fn() } }
})

import { mailSettingsApi } from '../lib/api'
import MailSettings from '../admin/MailSettings'
import { useUiStore } from '../store/uiStore'

const toasts = () => useUiStore.getState().toasts.map((t) => t.message)
const httpError = (error) => Object.assign(new Error('x'), { response: { status: 502, data: { error } } })

beforeEach(() => {
  vi.clearAllMocks()
  useUiStore.setState({ toasts: [] })
  mailSettingsApi.get.mockResolvedValue({ configured: false, source: null })
})

describe('MailSettings (paneldən Gmail qoşulması)', () => {
  it('qoşulmayıbsa xəbərdarlıq və addım-addım App Password izahı göstərilir, sınaq/silmə düymələri yoxdur', async () => {
    render(<MailSettings />)
    expect(await screen.findByText(/Qoşulmayıb/)).toBeInTheDocument()
    expect(screen.getByText('App Password necə yaradılır? (bir dəfəlik, 2 dəqiqə)')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'myaccount.google.com/apppasswords' })).toHaveAttribute('href', 'https://myaccount.google.com/apppasswords')
    expect(screen.queryByRole('button', { name: 'Sınaq məktubu göndər' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Bağlantını sil' })).toBeNull()
  })

  it('Gmail və App Password yazılır → serverə göndərilir → "Qoşulub" statusu, sahələr təmizlənir (şifrə ekranda qalmır)', async () => {
    mailSettingsApi.save.mockResolvedValue({ configured: true, source: 'panel', smtp_user: 'restoran@gmail.com', message: 'Gmail qoşuldu — şifrəni unutdum məktubları indi göndəriləcək.' })
    render(<MailSettings />)
    await screen.findByText(/Qoşulmayıb/)
    await userEvent.type(screen.getByLabelText('Gmail ünvanı'), 'restoran@gmail.com')
    await userEvent.type(screen.getByLabelText('App Password (16 simvol)'), 'abcd efgh ijkl mnop')
    await userEvent.click(screen.getByRole('button', { name: 'Yoxla və saxla' }))
    await waitFor(() => expect(mailSettingsApi.save).toHaveBeenCalledWith({ smtp_user: 'restoran@gmail.com', smtp_pass: 'abcd efgh ijkl mnop' }))
    const status = await screen.findByTestId('mail-status')
    await waitFor(() => expect(status).toHaveTextContent('✓ Qoşulub · restoran@gmail.com'))
    expect(status).toHaveTextContent('paneldən qoşulub')
    expect(screen.getByLabelText('App Password (16 simvol)')).toHaveValue('')
    expect(screen.getByLabelText('Gmail ünvanı')).toHaveValue('')
    expect(toasts().join(' ')).toContain('Gmail qoşuldu')
    expect(screen.getByRole('button', { name: 'Sınaq məktubu göndər' })).toBeInTheDocument()
    expect(document.body.textContent).not.toContain('abcd efgh')
  })

  it('yanlış App Password: serverin izahı göstərilir və status dəyişmir', async () => {
    mailSettingsApi.save.mockRejectedValue(httpError('Gmail girişi qəbul olunmadı — şifrə Google "Tətbiq şifrəsi" olmalıdır'))
    render(<MailSettings />)
    await screen.findByText(/Qoşulmayıb/)
    await userEvent.type(screen.getByLabelText('Gmail ünvanı'), 'restoran@gmail.com')
    await userEvent.type(screen.getByLabelText('App Password (16 simvol)'), 'yanlis-sifre-123')
    await userEvent.click(screen.getByRole('button', { name: 'Yoxla və saxla' }))
    await waitFor(() => expect(toasts().join(' ')).toContain('Tətbiq şifrəsi'))
    expect(screen.getByTestId('mail-status')).toHaveTextContent('Qoşulmayıb')
  })

  it('qoşulubsa: sınaq məktubu göndərilir; silmə təsdiqlə işləyir və status "Qoşulmayıb"a qayıdır', async () => {
    mailSettingsApi.get.mockResolvedValue({ configured: true, source: 'panel', smtp_user: 'restoran@gmail.com' })
    mailSettingsApi.test.mockResolvedValue({ to: 'restoran@gmail.com', message: 'Sınaq məktubu restoran@gmail.com ünvanına göndərildi.' })
    mailSettingsApi.remove.mockResolvedValue({ configured: false, source: null })
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<MailSettings />)
    await userEvent.click(await screen.findByRole('button', { name: 'Sınaq məktubu göndər' }))
    await waitFor(() => expect(toasts().join(' ')).toContain('Sınaq məktubu restoran@gmail.com'))
    await userEvent.click(screen.getByRole('button', { name: 'Bağlantını sil' }))
    await waitFor(() => expect(screen.getByTestId('mail-status')).toHaveTextContent('Qoşulmayıb'))
    expect(mailSettingsApi.remove).toHaveBeenCalled()
  })

  it('.env-dən qoşulubsa "silmə" düyməsi yoxdur (paneldən silinə bilməz)', async () => {
    mailSettingsApi.get.mockResolvedValue({ configured: true, source: 'env', smtp_user: 'env@gmail.com' })
    render(<MailSettings />)
    expect(await screen.findByText(/\.env faylından/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Bağlantını sil' })).toBeNull()
  })
})
