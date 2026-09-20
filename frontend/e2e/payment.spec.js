import { test, expect } from '@playwright/test'

const API = process.env.E2E_API_URL || 'http://localhost:4000/api'
const ADMIN = { email: 'admin@qrmenu.local', password: process.env.E2E_ADMIN_PASSWORD || 'ChangeMe123!' }

// Ödəniş axını (PAYMENT_PROVIDER=test): onlayn ödəniş rədd → yenidən cəhd → uğurlu; ödəniş təsdiqlənənə qədər sifariş mətbəxdə/adminin bildirişlərində görünmür.
// Nağd sifariş: işçi "Nağd alındı" edir. Restoran ayarı test sonunda əvvəlki vəziyyətinə qaytarılır.
test('ödəniş: onlayn (rədd → təkrar → uğurlu) və nağd', async ({ browser }) => {
  const adminCtx = await browser.newContext()
  const customerCtx = await browser.newContext()
  const admin = await adminCtx.newPage()
  const customer = await customerCtx.newPage()
  const orderIds = []
  let restaurantBefore = null

  let product
  try {
    await admin.goto('/admin/login')
    await admin.locator('input[type=email]').fill(ADMIN.email)
    await admin.locator('input[type=password]').fill(ADMIN.password)
    await admin.getByRole('button', { name: 'Daxil ol' }).click()
    await expect(admin).toHaveURL(/\/admin\/dashboard/)

    restaurantBefore = await (await adminCtx.request.get(`${API}/restaurant`)).json()
    test.skip(!restaurantBefore.online_payment_available, 'PAYMENT_PROVIDER=test backend-də qoşulmayıb')
    await adminCtx.request.put(`${API}/restaurant`, { data: { ...restaurantBefore, pay_online: true } })

    const products = await (await adminCtx.request.get(`${API}/products`)).json()
    product = products.find((p) => p.is_available && p.is_visible !== false && !p.track_inventory)
    expect(product).toBeTruthy()

    // ---- Onlayn: müştəri ödəniş üsulunu seçir (üç üsul görünür)
    await customer.goto('/menyu')
    await customer.goto(`/product/${product.id}`)
    await customer.getByRole('button', { name: /Sifarişə əlavə et/ }).click()
    await customer.goto('/cart')
    await customer.getByRole('button', { name: 'Davam et' }).click()
    await expect(customer.getByRole('radio')).toHaveCount(3)
    await customer.getByPlaceholder('Ad Soyad').fill('E2E Ödəniş')
    await customer.getByPlaceholder('+994 XX XXX XX XX').fill('+994501112233')
    await customer.getByRole('radio', { name: /Onlayn kart/ }).check()
    await customer.getByRole('button', { name: 'Ödənişə keç' }).click()
    await customer.getByRole('button', { name: 'Təsdiqlə', exact: true }).click()

    // Saxta ödəniş səhifəsi açılır (real provayderdə bankın kart səhifəsi)
    await expect(customer).toHaveURL(/\/pay\/test\?o=/)
    await customer.getByRole('button', { name: /Ödənişi rədd et/ }).click()

    // Sifariş səhifəsinə qayıdır: ödəniş alınmadı, "Yenidən cəhd et" var
    await expect(customer).toHaveURL(/\/order\/(\d+)\?token=.*pay=error/)
    const orderId = Number(customer.url().match(/\/order\/(\d+)/)[1])
    orderIds.push(orderId)
    await expect(customer.getByTestId('payment-panel')).toHaveAttribute('data-state', 'failed')

    // Ödəniş təsdiqlənməyib → admin sifarişi "Ödəniş alınmadı" kimi görür, irəlilətmək düyməsi yoxdur; mətbəxdə yoxdur
    await admin.goto('/admin/orders')
    const card = admin.locator('div.rounded-2xl', { hasText: `#${orderId}` }).first()
    await expect(card.getByTestId('order-payment')).toContainText('Ödəniş alınmadı')
    await expect(card.getByRole('button', { name: /→/ })).toHaveCount(0)
    await admin.goto('/kitchen')
    await expect(admin.locator('article', { hasText: `#${orderId}` })).toHaveCount(0)

    // Yenidən cəhd → uğurlu
    await customer.getByRole('button', { name: 'Yenidən cəhd et' }).click()
    await expect(customer).toHaveURL(/\/pay\/test\?o=/)
    await customer.getByRole('button', { name: /Uğurlu ödə/ }).click()
    await expect(customer.getByTestId('payment-panel')).toHaveAttribute('data-state', 'paid')
    await expect(customer.getByTestId('payment-panel')).toContainText('Ödənilib')

    // Ödəniş təsdiqləndi → sifariş indi mətbəxdə və admin siyahısında "Ödənilib"
    await admin.goto('/kitchen')
    await expect(admin.locator('article', { hasText: `#${orderId}` })).toBeVisible()
    await admin.goto('/admin/orders')
    await expect(admin.locator('div.rounded-2xl', { hasText: `#${orderId}` }).first().getByTestId('order-payment')).toContainText('Ödənilib')

    // Admin (OWNER) ödənilmiş onlayn sifarişi geri qaytarır → hər iki tərəfdə "Geri qaytarılıb"
    const paidCard = admin.locator('div.rounded-2xl', { hasText: `#${orderId}` }).first()
    admin.once('dialog', (d) => d.accept())
    await paidCard.getByRole('button', { name: 'Pulu geri qaytar' }).click()
    await expect(paidCard.getByTestId('order-payment')).toContainText('Geri qaytarılıb')
    await expect(paidCard.getByRole('button', { name: 'Pulu geri qaytar' })).toHaveCount(0)
    await expect(customer.getByTestId('payment-panel')).toHaveAttribute('data-state', 'refunded')

    // Səhifəni yeniləsək də status serverdən gəlir (URL-dəki pay=success tək başına heç nə sübut etmir)
    await customer.goto(`/order/${orderId}?token=${new URL(customer.url()).searchParams.get('token')}&pay=success`)
    await expect(customer.getByTestId('payment-panel')).toHaveAttribute('data-state', 'refunded') // geri qaytarılıb — URL-dəki pay=success bunu "ödənilib"ə çevirmir

    // ---- Nağd: yeni sifariş dərhal mətbəxə/adminə çatır, işçi "Nağd alındı" edir
    await customer.goto(`/product/${product.id}`)
    await customer.getByRole('button', { name: /Sifarişə əlavə et/ }).click()
    await customer.goto('/cart')
    await customer.getByRole('button', { name: 'Davam et' }).click()
    await customer.getByPlaceholder('Ad Soyad').fill('E2E Nağd')
    await customer.getByPlaceholder('+994 XX XXX XX XX').fill('+994501112233')
    await customer.getByRole('radio', { name: /^Nağd/ }).check()
    await customer.getByRole('button', { name: 'Sifarişi təsdiqlə' }).click()
    await customer.getByRole('button', { name: 'Təsdiqlə', exact: true }).click()
    await expect(customer).toHaveURL(/\/order\/(\d+)\?token=/)
    const cashId = Number(customer.url().match(/\/order\/(\d+)/)[1])
    orderIds.push(cashId)
    await expect(customer.getByTestId('payment-panel')).toHaveAttribute('data-state', 'unpaid')

    await admin.goto('/admin/orders')
    const cashCard = admin.locator('div.rounded-2xl', { hasText: `#${cashId}` }).first()
    await expect(cashCard.getByTestId('order-payment')).toContainText('Ödənilməyib')
    await cashCard.getByRole('button', { name: 'Nağd alındı' }).click()
    await expect(cashCard.getByTestId('order-payment')).toContainText('Ödənilib')
    await expect(cashCard.getByRole('button', { name: 'Nağd alındı' })).toHaveCount(0)
    // müştərinin açıq səhifəsində real vaxtda "Ödənilib"
    await expect(customer.getByTestId('payment-panel')).toHaveAttribute('data-state', 'paid')
  } finally {
    for (const id of orderIds) await adminCtx.request.put(`${API}/orders/${id}`, { data: { status: 'CANCELLED' } }).catch(() => {})
    if (restaurantBefore) await adminCtx.request.put(`${API}/restaurant`, { data: restaurantBefore }).catch(() => {})
    await adminCtx.close()
    await customerCtx.close()
  }
})
