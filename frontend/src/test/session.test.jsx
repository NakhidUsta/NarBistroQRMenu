import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { apiClient, authApi } from '../lib/api'
import AccountAdmin, { describeDevice } from '../admin/AccountAdmin'
import { useAuthStore } from '../store/authStore'

const originalAdapter = apiClient.defaults.adapter
const originalLocation = window.location

// Server əvəzi: hər sorğu üçün (config) → { status, data } qaytaran handler
function fakeServer(handler) {
  const calls = []
  apiClient.defaults.adapter = async (config) => {
    calls.push(`${config.method.toUpperCase()} ${config.url}`)
    const { status, data } = await handler(config, calls)
    const response = { data, status, statusText: '', headers: {}, config, request: {} }
    if (status >= 400) {
      const err = new Error(`Request failed ${status}`)
      err.config = config
      err.response = response
      throw err
    }
    return response
  }
  return calls
}

function setPath(pathname) {
  Object.defineProperty(window, 'location', { configurable: true, value: { ...originalLocation, pathname, href: pathname } })
}

beforeEach(() => setPath('/admin/orders'))
afterEach(() => {
  apiClient.defaults.adapter = originalAdapter
  Object.defineProperty(window, 'location', { configurable: true, value: originalLocation })
})

describe('API klienti: səssiz refresh', () => {
  it('401 alanda bir dəfə yenilənib sorğunu təkrarlayır və nəticəni qaytarır', async () => {
    let expired = true
    const calls = fakeServer((config) => {
      if (config.url === '/auth/refresh') { expired = false; return { status: 200, data: { admin: {} } } }
      return expired ? { status: 401, data: { error: 'bitib' } } : { status: 200, data: [{ id: 1 }] }
    })
    const res = await apiClient.get('/orders')
    expect(res.data).toEqual([{ id: 1 }])
    expect(calls).toEqual(['GET /orders', 'POST /auth/refresh', 'GET /orders'])
  })

  it('eyni anda 3 sorğu 401 alsa yalnız BİR refresh göndərilir (token rotasiyası paralel cəhdi pozar)', async () => {
    let expired = true
    const calls = fakeServer(async (config) => {
      if (config.url === '/auth/refresh') {
        await new Promise((r) => setTimeout(r, 30))
        expired = false
        return { status: 200, data: {} }
      }
      return expired ? { status: 401, data: {} } : { status: 200, data: config.url }
    })
    const results = await Promise.all([apiClient.get('/a'), apiClient.get('/b'), apiClient.get('/c')])
    expect(results.map((r) => r.data)).toEqual(['/a', '/b', '/c'])
    expect(calls.filter((c) => c === 'POST /auth/refresh')).toHaveLength(1)
  })

  it('refresh də uğursuzdursa sorğu rədd edilir və giriş səhifəsinə yönləndirilir', async () => {
    fakeServer(() => ({ status: 401, data: {} }))
    await expect(apiClient.get('/orders')).rejects.toMatchObject({ response: { status: 401 } })
    expect(window.location.href).toBe('/admin/login')
  })

  it('təkrarlanan sorğu yenə 401 alsa sonsuz dövr yoxdur (yalnız bir refresh)', async () => {
    const calls = fakeServer((config) => (config.url === '/auth/refresh' ? { status: 200, data: {} } : { status: 401, data: {} }))
    await expect(apiClient.get('/orders')).rejects.toMatchObject({ response: { status: 401 } })
    expect(calls.filter((c) => c === 'POST /auth/refresh')).toHaveLength(1)
    expect(calls.filter((c) => c === 'GET /orders')).toHaveLength(2)
  })

  it('giriş sorğusu (yanlış şifrə) refresh cəhdi etmir', async () => {
    const calls = fakeServer(() => ({ status: 401, data: { error: 'Yanlış' } }))
    await expect(apiClient.post('/auth/login', {})).rejects.toBeTruthy()
    expect(calls).toEqual(['POST /auth/login'])
  })

  it('müştəri (admin olmayan) səhifədə 401 refresh cəhdi etmir və yönləndirmir', async () => {
    setPath('/menyu')
    const calls = fakeServer(() => ({ status: 401, data: {} }))
    await expect(apiClient.get('/products')).rejects.toBeTruthy()
    expect(calls).toEqual(['GET /products'])
    expect(window.location.href).toBe('/menyu')
  })

  it('/auth/me səhifə yenilənəndə (access bitib) əvvəl refresh edir, sonra admini qaytarır', async () => {
    setPath('/admin/dashboard')
    let expired = true
    const calls = fakeServer((config) => {
      if (config.url === '/auth/refresh') { expired = false; return { status: 200, data: {} } }
      return expired ? { status: 401, data: {} } : { status: 200, data: { admin: { email: 'a@b.az' } } }
    })
    expect((await authApi.me()).admin.email).toBe('a@b.az')
    expect(calls).toEqual(['GET /auth/me', 'POST /auth/refresh', 'GET /auth/me'])
  })

  it('/auth/me refresh də alınmayanda giriş səhifəsinə YÖNLƏNDİRMİR (giriş formu özü göstərilir)', async () => {
    setPath('/admin/login')
    fakeServer(() => ({ status: 401, data: {} }))
    await expect(authApi.me()).rejects.toBeTruthy()
    expect(window.location.href).toBe('/admin/login')
  })
})

describe('AccountAdmin: aktiv cihazlar', () => {
  const sessions = [
    { id: 1, user_agent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/120 Safari/537', ip: '10.0.0.1', last_used_at: new Date().toISOString(), current: true },
    { id: 2, user_agent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17) Safari/604', ip: '10.0.0.2', last_used_at: new Date().toISOString(), current: false },
  ]

  beforeEach(() => {
    useAuthStore.setState({ admin: { id: 1, email: 'o@x.az', role: 'OWNER' } })
    vi.spyOn(window, 'confirm').mockReturnValue(true)
  })

  it('cihaz təsviri User-Agent-dən çıxarılır', () => {
    expect(describeDevice('Mozilla/5.0 (Windows NT 10.0) AppleWebKit Chrome/120.0 Safari/537')).toBe('Chrome · Windows')
    expect(describeDevice('Mozilla/5.0 (Windows NT 10.0) Chrome/120 Edg/120')).toBe('Edge · Windows')
    expect(describeDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 17) Safari/604')).toBe('Safari · iOS')
    expect(describeDevice('')).toBe('Brauzer')
  })

  it('cihazları göstərir, cari cihazı işarələyir; yalnız digərlərini bağlamaq olur', async () => {
    const calls = fakeServer((config) => {
      if (config.url === '/auth/sessions') return { status: 200, data: sessions }
      return { status: 204, data: null }
    })
    render(<MemoryRouter><AccountAdmin /></MemoryRouter>)
    const items = await screen.findAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(screen.getByText('Bu cihaz')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Bağla' })).toHaveLength(1)
    await userEvent.click(screen.getByRole('button', { name: 'Bağla' }))
    expect(calls).toContain('DELETE /auth/sessions/2')
  })
})
