import { test, expect } from '@playwright/test'

const API = process.env.E2E_API_URL || 'http://localhost:4000/api'
const ADMIN = { email: 'admin@qrmenu.local', password: process.env.E2E_ADMIN_PASSWORD || 'ChangeMe123!' }
const COMMENT = `E2E rəy ${Date.now()}`

// Müştəri rəyi: sifariş təhvil verilir → rəy yazılır (gözləyir) → admin dərc edir → menyuda görünür.
test('rəy axını: yaz → moderasiya → dərc', async ({ browser }) => {
  const adminCtx = await browser.newContext()
  const customerCtx = await browser.newContext()
  const admin = await adminCtx.newPage()
  const customer = await customerCtx.newPage()
  let orderId
  let reviewId

  try {
    await admin.goto('/admin/login')
    await admin.locator('input[type=email]').fill(ADMIN.email)
    await admin.locator('input[type=password]').fill(ADMIN.password)
    await admin.getByRole('button', { name: 'Daxil ol' }).click()
    await expect(admin).toHaveURL(/\/admin\/dashboard/)

    // Sifariş (müştəri API-si ilə) → admin "Çatdırıldı" edir
    const products = await (await adminCtx.request.get(`${API}/products`)).json()
    const product = products.find((p) => p.is_available && !p.track_inventory)
    const order = await (await customerCtx.request.post(`${API}/orders`, {
      data: { customer_name: 'E2E Rəy', phone: '+994501112233', items: [{ product_id: product.id, quantity: 1 }] },
    })).json()
    orderId = order.id
    await customer.goto(`/order/${orderId}?token=${order.access_token}`)
    await expect(customer.getByText('Sifariş detalları')).toBeVisible()

    // Hazır olmayan sifarişdə rəy formu YOXDUR
    await expect(customer.getByText('Sifarişi qiymətləndirin')).toHaveCount(0)

    // Admin statusu DELIVERED-ə qədər irəlilədir → müştəri ekranında rəy formu avtomatik açılır
    for (const status of ['CONFIRMED', 'PREPARING', 'READY', 'DELIVERED']) {
      await adminCtx.request.put(`${API}/orders/${orderId}`, { data: { status } })
    }
    await expect(customer.getByText('Sifarişi qiymətləndirin')).toBeVisible()

    // Rəy yaz (4 ulduz)
    await customer.getByRole('radio', { name: '4' }).click()
    await customer.getByPlaceholder('Fikrinizi yazın (istəyə bağlı)').fill(COMMENT)
    await customer.getByRole('button', { name: 'Rəy göndər' }).click()
    await expect(customer.getByText(/Rəyiniz üçün təşəkkür/)).toBeVisible()

    // Moderasiyadan əvvəl açıq menyuda görünmür
    const before = await (await customerCtx.request.get(`${API}/reviews/public`)).json()
    expect(before.reviews.some((r) => r.comment === COMMENT)).toBe(false)

    // Təkrar rəy yazmaq olmaz
    const dup = await customerCtx.request.post(`${API}/reviews/order/${orderId}`, { data: { token: order.access_token, rating: 5 } })
    expect(dup.status()).toBe(409)

    // Admin "Dərc et"
    await admin.goto('/admin/reviews')
    const card = admin.locator('div.rounded-2xl', { hasText: COMMENT }).first()
    await expect(card).toBeVisible()
    await card.getByRole('button', { name: 'Dərc et' }).click()

    // Menyuda görünür
    await customer.goto('/menyu')
    await expect(customer.getByText('Qonaq rəyləri')).toBeVisible()
    await expect(customer.getByText(COMMENT)).toBeVisible()

    const all = await (await adminCtx.request.get(`${API}/reviews`)).json()
    reviewId = all.find((r) => r.comment === COMMENT).id
  } finally {
    if (reviewId) await adminCtx.request.delete(`${API}/reviews/${reviewId}`)
    if (orderId) await adminCtx.request.put(`${API}/orders/${orderId}`, { data: { status: 'CANCELLED' } })
    await adminCtx.close()
    await customerCtx.close()
  }
})
