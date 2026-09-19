import { test, expect } from '@playwright/test'

const API = process.env.E2E_API_URL || 'http://localhost:4000/api'
const ADMIN = { email: 'admin@qrmenu.local', password: process.env.E2E_ADMIN_PASSWORD || 'ChangeMe123!' }

async function login(page) {
  await page.goto('/admin/login')
  await page.locator('input[type=email]').fill(ADMIN.email)
  await page.locator('input[type=password]').fill(ADMIN.password)
  await page.getByRole('button', { name: 'Daxil ol' }).click()
  await expect(page).toHaveURL(/\/admin\/dashboard/)
}

const cookieValue = async (context, name) => (await context.cookies()).find((c) => c.name === name)?.value

// Access token (15 dəq) bitəndə istifadəçi giriş səhifəsinə atılmamalı — refresh cookie ilə səssiz yenilənməlidir.
test('access token bitəndə səhifə səssiz yenilənir; refresh də yoxdursa giriş səhifəsinə yönləndirilir', async ({ browser }) => {
  const context = await browser.newContext()
  const page = await context.newPage()
  try {
    await login(page)
    const firstAccess = await cookieValue(context, 'qrmenu_token')
    const firstRefresh = await cookieValue(context, 'qrmenu_refresh')
    expect(firstAccess).toBeTruthy()
    expect(firstRefresh).toBeTruthy()

    await page.waitForTimeout(1100) // JWT iat saniyə dəqiqliyindədir — yeni token fərqli olsun
    // Access token-in vaxtı bitməsini təqlid et (yalnız o cookie silinir)
    await context.clearCookies({ name: 'qrmenu_token' })
    await page.goto('/admin/orders')
    await expect(page).toHaveURL(/\/admin\/orders/)
    await expect(page.getByPlaceholder(/Axtar/)).toBeVisible()

    // Rotasiya: həm access, həm refresh yenilənib
    const secondAccess = await cookieValue(context, 'qrmenu_token')
    const secondRefresh = await cookieValue(context, 'qrmenu_refresh')
    expect(secondAccess).toBeTruthy()
    expect(secondAccess).not.toBe(firstAccess)
    expect(secondRefresh).not.toBe(firstRefresh)

    // Cihaz siyahısında bu sessiya "Bu cihaz" kimi görünür
    await page.goto('/admin/account')
    await expect(page.getByText('Bu cihaz')).toBeVisible()

    // Hər iki cookie yoxdursa (sessiya bitib) giriş səhifəsinə yönləndirilir
    await context.clearCookies()
    await page.goto('/admin/orders')
    await expect(page).toHaveURL(/\/admin\/login/)
  } finally {
    await context.request.post(`${API}/auth/logout`).catch(() => {})
    await context.close()
  }
})

test('çıxış edildikdən sonra köhnə refresh cookie ilə yenidən girmək olmur', async ({ browser }) => {
  const context = await browser.newContext()
  const page = await context.newPage()
  try {
    await login(page)
    const stolenRefresh = await cookieValue(context, 'qrmenu_refresh')
    await page.getByRole('button', { name: 'Çıxış et' }).click()
    await expect(page).toHaveURL(/\/admin\/login/)

    // köhnə refresh token-i "oğurlayıb" təkrar istifadə etməyə çalış
    const attacker = await browser.newContext()
    const res = await attacker.request.post(`${API}/auth/refresh`, { headers: { cookie: `qrmenu_refresh=${stolenRefresh}` } })
    expect(res.status()).toBe(401)
    await attacker.close()
  } finally {
    await context.close()
  }
})
