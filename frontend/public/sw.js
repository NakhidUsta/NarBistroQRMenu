// QR Menu service worker — menyu və şəkillər offline açılsın deyə.
// Yalnız GET sorğuları keşlənir; sifariş/auth/admin sorğularına toxunulmur.
const VERSION = 'v1'
const SHELL_CACHE = `qrmenu-shell-${VERSION}`
const DATA_CACHE = `qrmenu-data-${VERSION}`
const IMG_CACHE = `qrmenu-img-${VERSION}`
const IMG_LIMIT = 80

const PUBLIC_API = ['/api/products', '/api/categories', '/api/restaurant', '/api/allergens', '/api/ingredients']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((c) => c.addAll(['/', '/offline.html', '/manifest.webmanifest', '/icons/icon-192.png'])).then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('qrmenu-') && !k.endsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

async function trimCache(name, max) {
  const cache = await caches.open(name)
  const keys = await cache.keys()
  if (keys.length > max) await Promise.all(keys.slice(0, keys.length - max).map((k) => cache.delete(k)))
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName)
  try {
    const response = await fetch(request)
    if (response.ok) cache.put(request, response.clone())
    return response
  } catch (err) {
    const cached = await cache.match(request)
    if (cached) return cached
    throw err
  }
}

async function staleWhileRevalidate(request, cacheName, limit) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)
  const network = fetch(request)
    .then((response) => {
      if (response.ok || response.type === 'opaque') {
        cache.put(request, response.clone()).then(() => limit && trimCache(cacheName, limit))
      }
      return response
    })
    .catch(() => cached)
  return cached || network
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)

  // Səhifə naviqasiyası: şəbəkə → keşlənmiş app shell → offline səhifə
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          caches.open(SHELL_CACHE).then((c) => c.put('/', response.clone()))
          return response
        })
        .catch(async () => (await caches.match('/')) || caches.match('/offline.html')),
    )
    return
  }

  // Açıq menyu API-si (backend başqa origin-dədir, ona görə yol adına görə yoxlayırıq)
  if (PUBLIC_API.some((p) => url.pathname === p || url.pathname.startsWith(`${p}/`))) {
    event.respondWith(networkFirst(request, DATA_CACHE))
    return
  }

  if (url.pathname.startsWith('/api')) return

  // Şəkillər (yüklənmiş fayllar + xarici) və statik fayllar
  if (request.destination === 'image' || url.pathname.startsWith('/uploads/')) {
    event.respondWith(staleWhileRevalidate(request, IMG_CACHE, IMG_LIMIT))
    return
  }

  if (url.origin === self.location.origin && (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/'))) {
    event.respondWith(staleWhileRevalidate(request, SHELL_CACHE))
  }
})
