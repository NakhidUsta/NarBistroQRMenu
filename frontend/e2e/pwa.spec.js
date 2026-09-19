import { test, expect } from '@playwright/test'

// Yalnız production build üzərində işləyir (service worker dev-də qeydiyyatdan keçmir):
//   npm run build && npx vite preview --port 5174 --strictPort   →   E2E_PROD=1 npx playwright test pwa
test.skip(!process.env.E2E_PROD, 'production build tələb olunur (E2E_PROD=1)')

test('PWA: manifest, service worker, offline menyu və bərpa', async ({ browser }) => {
  const context = await browser.newContext({ serviceWorkers: 'allow' })
  const page = await context.newPage()

  // Manifest etibarlıdır və ikonlar açılır
  const manifest = await (await context.request.get('/manifest.webmanifest')).json()
  expect(manifest.display).toBe('standalone')
  expect(manifest.icons.map((i) => i.sizes)).toEqual(expect.arrayContaining(['192x192', '512x512']))
  for (const icon of manifest.icons) expect((await context.request.get(icon.src)).status()).toBe(200)

  // Onlayn: menyu yüklənir, service worker aktivləşir
  await page.goto('/menyu')
  await expect(page.getByPlaceholder('Menyuda axtar...')).toBeVisible()
  const firstProduct = page.locator('a[href^="/product/"]').first()
  await expect(firstProduct).toBeVisible()
  const productName = (await firstProduct.locator('h3').innerText()).trim()

  await page.evaluate(async () => { await navigator.serviceWorker.ready })
  // API cavabları SW keşinə düşsün deyə səhifəni SW nəzarəti altında bir dəfə də yüklə
  await page.reload()
  await expect(page.locator('a[href^="/product/"]').first()).toBeVisible()
  await page.waitForTimeout(800)

  const cached = await page.evaluate(async () => {
    const out = {}
    for (const name of await caches.keys()) out[name] = (await (await caches.open(name)).keys()).map((r) => new URL(r.url).pathname)
    return out
  })
  const allPaths = Object.values(cached).flat()
  expect(allPaths).toEqual(expect.arrayContaining(['/', '/offline.html', '/api/products', '/api/categories']))

  // OFFLINE: səhifə yenilənir → menyu yaddaşdan açılır, offline banneri görünür
  await context.setOffline(true)
  await page.reload()
  await expect(page.getByText(productName).first()).toBeVisible()
  await expect(page.getByText(/Offline rejim/)).toBeVisible()

  // Offline ikən sifariş göndərmək bloklanır (səbət yoxdur → toast yoxlanmır, yalnız banner)
  // Bərpa: internet qayıdır → banner yox olur
  await context.setOffline(false)
  await page.evaluate(() => window.dispatchEvent(new Event('online')))
  await expect(page.getByText(/Offline rejim/)).toHaveCount(0)

  await context.close()
})
