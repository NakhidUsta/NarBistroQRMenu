import axios from 'axios'

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000/api',
  withCredentials: true,
})

// Access token qısa ömürlüdür (15 dəq). 401 alanda refresh cookie ilə səssiz yenilənib sorğu bir dəfə təkrarlanır;
// eyni anda bir neçə sorğu 401 alsa yalnız BİR yenilənmə göndərilir (refresh token rotasiya olunduğu üçün paralel göndərmək olmaz).
let refreshPromise = null

export function refreshSession() {
  if (!refreshPromise) {
    refreshPromise = apiClient
      .post('/auth/refresh', null, { __noRefresh: true })
      .then((res) => res.data)
      .finally(() => {
        refreshPromise = null
      })
  }
  return refreshPromise
}

const onAdminSurface = () =>
  typeof window !== 'undefined' && (window.location.pathname.startsWith('/admin') || window.location.pathname.startsWith('/kitchen'))

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    // Zəif internet: yalnız təhlükəsiz (GET) sorğuları şəbəkə xətasında 2 dəfə təkrar cəhd et.
    const config = error.config
    if (config && config.method === 'get' && !error.response && (config.__retry || 0) < 2) {
      config.__retry = (config.__retry || 0) + 1
      await new Promise((r) => setTimeout(r, 400 * 2 ** config.__retry))
      return apiClient(config)
    }

    const url = config?.url || ''
    const isLogin = url.includes('/auth/login')
    const isRefresh = url.includes('/auth/refresh')
    const isMe = url.includes('/auth/me')

    if (error.response?.status === 401 && config && !config.__refreshed && !config.__noRefresh && !isLogin && !isRefresh && (onAdminSurface() || isMe)) {
      try {
        await refreshSession()
        config.__refreshed = true
        return apiClient(config)
      } catch {
        // yenilənmə alınmadı (refresh bitib/bağlanıb) — aşağıda giriş səhifəsinə yönləndirilir
      }
    }

    if (error.response?.status === 401 && window.location.pathname.startsWith('/admin') && !isLogin && !isMe && !isRefresh) {
      window.location.href = '/admin/login'
    }
    return Promise.reject(error)
  },
)

function unwrap(promise) {
  return promise.then((res) => res.data)
}

export const restaurantApi = {
  get: () => unwrap(apiClient.get('/restaurant')),
  update: (body) => unwrap(apiClient.put('/restaurant', body)),
}

export const categoriesApi = {
  list: (includeInactive) => unwrap(apiClient.get('/categories', { params: includeInactive ? { includeInactive: true } : {} })),
  create: (body) => unwrap(apiClient.post('/categories', body)),
  update: (id, body) => unwrap(apiClient.put(`/categories/${id}`, body)),
  remove: (id) => apiClient.delete(`/categories/${id}`),
}

export const productsApi = {
  list: (params) => unwrap(apiClient.get('/products', { params })),
  get: (id) => unwrap(apiClient.get(`/products/${id}`)),
  create: (body) => unwrap(apiClient.post('/products', body)),
  update: (id, body) => unwrap(apiClient.put(`/products/${id}`, body)),
  setVisibility: (id, is_visible) => unwrap(apiClient.patch(`/products/${id}/visibility`, { is_visible })),
  setAvailability: (id, is_available) => unwrap(apiClient.patch(`/products/${id}/availability`, { is_available })),
  adjustStock: (id, change_qty) => unwrap(apiClient.patch(`/products/${id}/stock`, { change_qty })),
  remove: (id) => apiClient.delete(`/products/${id}`),
}

export const promosApi = {
  list: () => unwrap(apiClient.get('/promos')),
  create: (body) => unwrap(apiClient.post('/promos', body)),
  update: (id, body) => unwrap(apiClient.put(`/promos/${id}`, body)),
  remove: (id) => apiClient.delete(`/promos/${id}`),
}

export const tablesApi = {
  list: () => unwrap(apiClient.get('/tables')),
  create: (body) => unwrap(apiClient.post('/tables', body)),
  update: (id, body) => unwrap(apiClient.put(`/tables/${id}`, body)),
  regenerate: (id) => unwrap(apiClient.post(`/tables/${id}/regenerate`)),
  remove: (id) => apiClient.delete(`/tables/${id}`),
  scan: (code, token) => unwrap(apiClient.post(`/tables/${code}/scan`, { token })),
  callWaiter: (code) => unwrap(apiClient.post(`/tables/${code}/call-waiter`)),
  requestBill: (code) => unwrap(apiClient.post(`/tables/${code}/request-bill`)),
}

// Kursor səhifələmə cavabı: gövdə massivdir, "daha var" məlumatı X-Has-More başlığındadır
const withPage = (promise) => promise.then((res) => ({ items: res.data, hasMore: res.headers?.['x-has-more'] === '1' }))

export const notificationsApi = {
  list: () => unwrap(apiClient.get('/notifications')),
  listPage: (params) => withPage(apiClient.get('/notifications', { params })),
  markRead: (id) => unwrap(apiClient.patch(`/notifications/${id}/read`)),
  setStatus: (id, status) => unwrap(apiClient.patch(`/notifications/${id}/status`, { status })),
  markAllRead: () => apiClient.patch('/notifications/read-all'),
  remove: (id) => apiClient.delete(`/notifications/${id}`),
  clearRead: () => apiClient.delete('/notifications/read'),
}

export const ordersApi = {
  create: (body) => unwrap(apiClient.post('/orders', body)),
  quote: (body) => unwrap(apiClient.post('/orders/quote', body)),
  get: (id, token) => unwrap(apiClient.get(`/orders/${id}`, { params: token ? { token } : {} })),
  list: (params) => unwrap(apiClient.get('/orders', { params })),
  listPage: (params) => withPage(apiClient.get('/orders', { params })),
  updateStatus: (id, status, note) => unwrap(apiClient.put(`/orders/${id}`, { status, note })),
}

export const paymentsApi = {
  // Müştəri (sifariş tokeni ilə): onlayn ödənişi başlat → provayderin ödəniş səhifəsi
  start: (orderId, token, language) => unwrap(apiClient.post(`/payments/orders/${orderId}/start`, { token, language })),
  // Ödəniş səhifəsindən qayıdanda statusu serverdən təzələ (callback gecikə bilər)
  verify: (orderId, token) => unwrap(apiClient.post(`/payments/orders/${orderId}/verify`, { token })),
  testComplete: (body) => unwrap(apiClient.post('/payments/test/complete', body)),
  // Admin/ofisiant: nağd / kartla masada ödənişi qeyd et
  markPaid: (orderId, method) => unwrap(apiClient.post(`/orders/${orderId}/payment`, method ? { method } : {})),
  // OWNER/MANAGER: onlayn ödənişi provayder vasitəsilə tam geri qaytar
  refund: (orderId) => unwrap(apiClient.post(`/orders/${orderId}/refund`)),
  list: (orderId) => unwrap(apiClient.get(`/orders/${orderId}/payments`)),
}

export const reviewsApi = {
  publicList: () => unwrap(apiClient.get('/reviews/public')),
  orderStatus: (orderId, token) => unwrap(apiClient.get(`/reviews/order/${orderId}`, { params: { token } })),
  create: (orderId, token, body) => unwrap(apiClient.post(`/reviews/order/${orderId}`, { ...body, token })),
  list: () => unwrap(apiClient.get('/reviews')),
  setApproved: (id, is_approved) => unwrap(apiClient.patch(`/reviews/${id}`, { is_approved })),
  remove: (id) => apiClient.delete(`/reviews/${id}`),
}

export const insightsApi = {
  customers: (q) => unwrap(apiClient.get('/insights/customers', { params: q ? { q } : {} })),
  inventory: () => unwrap(apiClient.get('/insights/inventory')),
  async downloadCsv(kind, from, to) {
    const res = await apiClient.get(`/insights/reports/${kind}.csv`, { params: { from, to }, responseType: 'blob' })
    const url = URL.createObjectURL(res.data)
    const a = document.createElement('a')
    a.href = url
    a.download = `${kind}_${from}_${to}.csv`
    a.click()
    URL.revokeObjectURL(url)
  },
}

export const staffApi = {
  list: () => unwrap(apiClient.get('/staff')),
  create: (body) => unwrap(apiClient.post('/staff', body)),
  update: (id, body) => unwrap(apiClient.put(`/staff/${id}`, body)),
  remove: (id) => apiClient.delete(`/staff/${id}`),
}

export const auditApi = {
  list: (params) => unwrap(apiClient.get('/audit-logs', { params })),
  listPage: (params) => withPage(apiClient.get('/audit-logs', { params })),
}

export const authApi = {
  login: (email, password) => unwrap(apiClient.post('/auth/login', { email, password })),
  logout: () => unwrap(apiClient.post('/auth/logout')),
  refresh: () => refreshSession(),
  config: () => unwrap(apiClient.get('/auth/config')),
  forgotPassword: (email) => unwrap(apiClient.post('/auth/forgot-password', { email })),
  resetPassword: (token, new_password) => unwrap(apiClient.post('/auth/reset-password', { token, new_password })),
  verifyEmail: (token) => unwrap(apiClient.post('/auth/verify-email', { token })),
  sendVerification: () => unwrap(apiClient.post('/auth/send-verification')),
  testMail: () => unwrap(apiClient.post('/auth/test-mail')),
  changeEmail: (new_email, current_password) => unwrap(apiClient.post('/auth/change-email', { new_email, current_password })),
  sessions: () => unwrap(apiClient.get('/auth/sessions')),
  revokeSession: (id) => apiClient.delete(`/auth/sessions/${id}`),
  me: () => unwrap(apiClient.get('/auth/me')),
  changePassword: (current_password, new_password) => unwrap(apiClient.post('/auth/change-password', { current_password, new_password })),
  logoutAll: () => unwrap(apiClient.post('/auth/logout-all')),
}

export const adminApi = {
  dashboard: (params) => unwrap(apiClient.get('/admin/dashboard', { params })),
}

export const uploadApi = {
  upload: (file) => {
    const form = new FormData()
    form.append('image', file)
    return unwrap(apiClient.post('/upload', form, { headers: { 'Content-Type': 'multipart/form-data' } }))
  },
}

export function resolveUploadUrl(url) {
  if (!url) return ''
  if (url.startsWith('http')) return url
  const apiOrigin = (import.meta.env.VITE_API_URL || 'http://localhost:4000/api').replace(/\/api\/?$/, '')
  return `${apiOrigin}${url}`
}

export const mediaApi = {
  list: () => unwrap(apiClient.get('/media')),
  crop: (id, aspect, focus) => unwrap(apiClient.post(`/media/${id}/crop`, { aspect, focus })),
  remove: (id) => unwrap(apiClient.delete(`/media/${id}`)),
}

// Media Library-də yaradılan şəkillərin (m-<vaxt>-<hex>.<ext>) hazır variantları var; köhnə/xarici URL-lər olduğu kimi qalır.
const MEDIA_URL_RE = /^(\/uploads\/m-\d{13}-[a-f0-9]{8})\.[a-z]+$/

export function imageVariants(url) {
  const m = MEDIA_URL_RE.exec(url || '')
  if (!m) return null
  const base = m[1]
  return {
    thumb: `${base}-thumb.webp`,
    md: `${base}-md.webp`,
    lg: `${base}-lg.webp`,
    mdAvif: `${base}-md.avif`,
    lgAvif: `${base}-lg.avif`,
  }
}

export const allergensApi = {
  list: () => unwrap(apiClient.get('/allergens')),
}

export const ingredientsApi = {
  list: () => unwrap(apiClient.get('/ingredients')),
  create: (body) => unwrap(apiClient.post('/ingredients', body)),
  update: (id, body) => unwrap(apiClient.put(`/ingredients/${id}`, body)),
  remove: (id) => unwrap(apiClient.delete(`/ingredients/${id}`)),
}
