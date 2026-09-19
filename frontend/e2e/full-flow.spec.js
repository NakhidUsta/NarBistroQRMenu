import { test, expect } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const API = process.env.E2E_API_URL || 'http://localhost:4000/api'
const ADMIN = { email: 'admin@qrmenu.local', password: process.env.E2E_ADMIN_PASSWORD || 'ChangeMe123!' }
const IMAGE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons', 'icon-192.png')
const NAME = `E2E Pasta ${Date.now()}`

// PDF bölmə 5: admin → məhsul → müştəri → sifariş → status → bitib → qiymət → ümumi link, hamısı refresh-siz.
test('tam axın: admin ↔ müştəri real-time', async ({ browser }) => {
  const adminCtx = await browser.newContext()
  const customerCtx = await browser.newContext()
  const admin = await adminCtx.newPage()
  const customer = await customerCtx.newPage()
  let productId
  let orderId
  let mediaBefore = null

  try {
    // 1. Admin panelə daxil ol
    await admin.goto('/admin/login')
    await admin.locator('input[type=email]').fill(ADMIN.email)
    await admin.locator('input[type=password]').fill(ADMIN.password)
    await admin.getByRole('button', { name: 'Daxil ol' }).click()
    await expect(admin).toHaveURL(/\/admin\/dashboard/)

    mediaBefore = new Set((await (await adminCtx.request.get(`${API}/media`)).json()).map((m) => m.id))

    // Müştəri masasının cari QR məlumatı (admin sessiyası ilə)
    const tables = await (await adminCtx.request.get(`${API}/tables`)).json()
    const table = tables.find((t) => t.is_active)
    expect(table).toBeTruthy()

    // Müştəri səhifəsini ƏVVƏLCƏDƏN aç — sonrakı dəyişikliklər refresh-siz gəlməlidir (real-time)
    await customer.goto(`/menyu?table=${table.code}&t=${table.qr_token}`)
    await expect(customer.getByPlaceholder('Menyuda axtar...')).toBeVisible()
    await expect(customer.getByText(`Masa — ${table.label}`)).toBeVisible()

    // 2-6. Yeni məhsul yarat: ad, qiymət, şəkil, kateqoriya, saxla
    await admin.goto('/admin/menu')
    await admin.getByRole('button', { name: '+ Yeni məhsul' }).click()
    const form = admin.locator('form')
    await form.locator('label:text-is("Ad") + input').fill(NAME)
    await form.locator('label:text-is("Qiymət (₼)") + input').fill('15')
    await form.locator('label:text-is("Kateqoriya") + select').selectOption({ index: 1 })
    await form.locator('input[type=file]').setInputFiles(IMAGE)
    await expect(form.locator('img').first()).toBeVisible()
    await form.getByRole('button', { name: 'Saxla' }).click()
    await expect(admin.getByText(NAME)).toBeVisible()

    // 7-8. Müştəri səhifəsində məhsul dərhal görünür (yeniləmə yoxdur)
    await expect(customer.getByText(NAME)).toBeVisible()
    await expect(customer.getByText(NAME).locator('xpath=ancestor::a')).toContainText('15.00')

    // Admini sifarişlər lövhəsinə keçir (sifariş gələndə canlı görünməlidir)
    const products = await (await adminCtx.request.get(`${API}/products`)).json()
    productId = products.find((p) => p.name === NAME).id
    await admin.goto('/admin/orders')

    // 9-10. Müştəri səbətə əlavə edir və sifariş verir
    await customer.getByText(NAME).click()
    await customer.getByRole('button', { name: /Sifarişə əlavə et/ }).click()
    await customer.goto('/cart')
    await customer.getByRole('button', { name: 'Davam et' }).click()
    await customer.getByPlaceholder('Ad Soyad').fill('E2E Müştəri')
    await customer.getByPlaceholder('+994 XX XXX XX XX').fill('+994501112233')
    await customer.getByRole('button', { name: 'Sifarişi təsdiqlə' }).click()
    await customer.getByRole('button', { name: 'Təsdiqlə', exact: true }).click()
    await expect(customer).toHaveURL(/\/order\/\d+/)
    orderId = Number(customer.url().match(/\/order\/(\d+)/)[1])

    // 11. Admin panelində sifariş dərhal görünür (refresh yoxdur)
    const card = admin.locator('div.rounded-2xl', { hasText: `#${orderId}` }).filter({ hasText: NAME }).first()
    await expect(card).toBeVisible()
    await expect(card).toContainText(NAME)

    // 12-13. Admin "Hazırlanır" edir → müştəri ekranında avtomatik dəyişir
    await card.getByRole('button', { name: /Təsdiqləndi/ }).click()
    await expect(card.getByText('Təsdiqləndi', { exact: true })).toBeVisible()
    await card.getByRole('button', { name: /Hazırlanır/ }).click()
    await expect(customer.getByText('✓')).toHaveCount(3)

    // 14-15. Admin "Ready" edir → müştəridə avtomatik
    await card.getByRole('button', { name: /Hazırdır/ }).click()
    await expect(customer.getByText('✓')).toHaveCount(4)

    // 16-17. Admin məhsulu "Bitib" edir → müştərinin açıq menyusunda dərhal "Bitib"
    await customer.goto(`/menyu?table=${table.code}&t=${table.qr_token}`)
    await expect(customer.getByText(NAME)).toBeVisible()
    await admin.goto('/admin/menu')
    const row = admin.locator('div.flex.gap-4', { hasText: NAME }).first()
    await row.getByRole('button', { name: 'Mövcuddur' }).click()
    await expect(customer.getByText(NAME).locator('xpath=ancestor::a')).toContainText('Bitib')

    // 18-19. Admin qiyməti dəyişir → müştəri ekranında yeni qiymət avtomatik
    await row.getByRole('button', { name: 'Redaktə' }).click()
    await admin.locator('form label:text-is("Qiymət (₼)") + input').fill('19.5')
    await admin.getByRole('button', { name: 'Saxla' }).click()
    await expect(customer.getByText(NAME).locator('xpath=ancestor::a')).toContainText('19.50')

    // 20-22. Ümumi /menyu linki (Instagram bio) admin paneldə var və masasız açılır
    await admin.goto('/admin/settings')
    await expect(admin.getByText('Instagram Bio Linki')).toBeVisible()
    await expect(admin.locator('input[readonly]')).toHaveValue(/\/menyu$/)
    const anon = await browser.newContext()
    const anonPage = await anon.newPage()
    await anonPage.goto('/menyu')
    await expect(anonPage.getByPlaceholder('Menyuda axtar...')).toBeVisible()
    await expect(anonPage.getByText('Masa —')).toHaveCount(0)
    await anon.close()

  } finally {
    // Təmizlik (test uğursuz olsa da): sifarişi ləğv et, məhsulu sil
    if (orderId) await adminCtx.request.put(`${API}/orders/${orderId}`, { data: { status: 'CANCELLED' } })
    if (productId) await adminCtx.request.delete(`${API}/products/${productId}`)
    // testin yüklədiyi şəkli media kitabxanasından da sil (məhsul silindiyi üçün artıq istifadədə deyil)
    if (mediaBefore) {
      const now = await (await adminCtx.request.get(`${API}/media`)).json()
      for (const m of now.filter((x) => !mediaBefore.has(x.id))) await adminCtx.request.delete(`${API}/media/${m.id}`)
    }
    await adminCtx.close()
    await customerCtx.close()
  }
})
