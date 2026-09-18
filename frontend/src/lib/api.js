import axios from 'axios'

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000/api',
  withCredentials: true,
})

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
    const isAuthCall = error.config?.url?.includes('/auth/login') || error.config?.url?.includes('/auth/me')
    const isAdminPath = typeof window !== 'undefined' && window.location.pathname.startsWith('/admin')
    if (error.response?.status === 401 && isAdminPath && !isAuthCall) {
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

export const notificationsApi = {
  list: () => unwrap(apiClient.get('/notifications')),
  markRead: (id) => unwrap(apiClient.patch(`/notifications/${id}/read`)),
  markAllRead: () => apiClient.patch('/notifications/read-all'),
  remove: (id) => apiClient.delete(`/notifications/${id}`),
  clearRead: () => apiClient.delete('/notifications/read'),
}

export const ordersApi = {
  create: (body) => unwrap(apiClient.post('/orders', body)),
  quote: (body) => unwrap(apiClient.post('/orders/quote', body)),
  get: (id, token) => unwrap(apiClient.get(`/orders/${id}`, { params: token ? { token } : {} })),
  list: (params) => unwrap(apiClient.get('/orders', { params })),
  updateStatus: (id, status, note) => unwrap(apiClient.put(`/orders/${id}`, { status, note })),
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
}

export const authApi = {
  login: (email, password) => unwrap(apiClient.post('/auth/login', { email, password })),
  logout: () => unwrap(apiClient.post('/auth/logout')),
  me: () => unwrap(apiClient.get('/auth/me')),
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
