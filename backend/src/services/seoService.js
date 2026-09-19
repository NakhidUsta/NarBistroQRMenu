const restaurantService = require('./restaurantService');
const productService = require('./productService');

// Sosial şəbəkə/axtarış robotları JS icra etmir — ona görə SPA-nın index.html-inə restoran və məhsul məlumatları
// (OG/Twitter/canonical/JSON-LD) server tərəfdə yeridilir. Məlumat admin paneldəki real DB-dən gəlir.

const PRIVATE_PREFIXES = ['/admin', '/kitchen', '/cart', '/order', '/favorites', '/orders'];
const CURRENCY = 'AZN';
const DEFAULT_IMAGE = '/icons/icon-512.png';

const escapeHtml = (v) =>
  String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// JSON-LD <script> daxilində "</script>" ilə blokun bağlanmasının qarşısı
const safeJson = (obj) => JSON.stringify(obj).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');

const truncate = (text, max) => {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
};

function absolute(baseUrl, url) {
  if (!url) return `${baseUrl}${DEFAULT_IMAGE}`;
  return /^https?:\/\//i.test(url) ? url : `${baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
}

function parseTheme(restaurant) {
  try {
    return restaurant.theme ? JSON.parse(restaurant.theme) : {};
  } catch {
    return {};
  }
}

function restaurantMeta(restaurant, baseUrl) {
  const theme = parseTheme(restaurant);
  const title = `${restaurant.name} — Rəqəmsal menyu`;
  const description = truncate(restaurant.about_text || theme.hero_subtitle || 'Menyuya baxın, QR ilə skan edib sifariş verin.', 200);
  const image = absolute(baseUrl, restaurant.logo_url || theme.hero_image_url);
  const sameAs = [restaurant.instagram_link, restaurant.facebook_link, restaurant.tiktok_link].filter(Boolean);
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Restaurant',
    name: restaurant.name,
    image,
    url: `${baseUrl}/menyu`,
    hasMenu: `${baseUrl}/menyu`,
    ...(restaurant.phone && { telephone: restaurant.phone }),
    ...(restaurant.address && { address: { '@type': 'PostalAddress', streetAddress: restaurant.address } }),
    ...(restaurant.working_hours && { openingHours: restaurant.working_hours }),
    ...(sameAs.length && { sameAs }),
  };
  return { title, description, image, url: `${baseUrl}/menyu`, type: 'website', jsonLd };
}

function productMeta(product, restaurant, baseUrl) {
  const price = Number(product.price).toFixed(2);
  const description = truncate(product.description || `${product.name} — ${restaurant.name}`, 200);
  const image = absolute(baseUrl, product.image_url || restaurant.logo_url);
  const url = `${baseUrl}/product/${product.id}`;
  return {
    title: `${product.name} — ${restaurant.name}`,
    description: `${description} · ${price} ₼`.slice(0, 240),
    image,
    url,
    type: 'product',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'MenuItem',
      name: product.name,
      description,
      image,
      url,
      offers: { '@type': 'Offer', price, priceCurrency: CURRENCY, availability: product.is_available ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock' },
    },
  };
}

const META_TTL_MS = 15000;
const META_CACHE_MAX = 500;
const metaCache = new Map();

// Autentifikasiyasız səhifə sorğuları hər dəfə DB-yə yük salmasın deyə qısa müddətli keş (admin dəyişikliyi ≤15 san-də görünür)
async function metaForPath(pathname, baseUrl) {
  const key = `${baseUrl}|${pathname}`;
  const hit = metaCache.get(key);
  if (hit && hit.expires > Date.now()) return hit.meta;
  const meta = await buildMeta(pathname, baseUrl);
  if (metaCache.size >= META_CACHE_MAX) metaCache.clear();
  metaCache.set(key, { meta, expires: Date.now() + META_TTL_MS });
  return meta;
}

async function buildMeta(pathname, baseUrl) {
  const restaurant = await restaurantService.getRestaurant();
  const noindex = PRIVATE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const match = /^\/product\/(\d+)\/?$/.exec(pathname);
  if (match) {
    try {
      const product = await productService.getProduct(Number(match[1]));
      return { ...productMeta(product, restaurant, baseUrl), noindex };
    } catch {
      // məhsul tapılmadısa restoran səviyyəli meta-ya düşür
    }
  }
  return { ...restaurantMeta(restaurant, baseUrl), noindex };
}

const HEAD_TAG_PATTERNS = [
  /<title>[\s\S]*?<\/title>\s*/i,
  /<meta\s+name="description"[^>]*>\s*/gi,
  /<meta\s+name="robots"[^>]*>\s*/gi,
  /<link\s+rel="canonical"[^>]*>\s*/gi,
  /<meta\s+property="og:[^"]*"[^>]*>\s*/gi,
  /<meta\s+name="twitter:[^"]*"[^>]*>\s*/gi,
];

function injectMeta(html, meta) {
  let out = html;
  for (const re of HEAD_TAG_PATTERNS) out = out.replace(re, '');
  const t = escapeHtml(meta.title);
  const d = escapeHtml(meta.description);
  const img = escapeHtml(meta.image);
  const url = escapeHtml(meta.url);
  const block = [
    `<title>${t}</title>`,
    `<meta name="description" content="${d}" />`,
    meta.noindex ? '<meta name="robots" content="noindex, nofollow" />' : '',
    `<link rel="canonical" href="${url}" />`,
    `<meta property="og:type" content="${escapeHtml(meta.type)}" />`,
    `<meta property="og:title" content="${t}" />`,
    `<meta property="og:description" content="${d}" />`,
    `<meta property="og:image" content="${img}" />`,
    `<meta property="og:url" content="${url}" />`,
    '<meta name="twitter:card" content="summary_large_image" />',
    `<meta name="twitter:title" content="${t}" />`,
    `<meta name="twitter:description" content="${d}" />`,
    `<meta name="twitter:image" content="${img}" />`,
    meta.noindex ? '' : `<script type="application/ld+json">${safeJson(meta.jsonLd)}</script>`,
  ].filter(Boolean).join('\n    ');
  // funksiya ilə əvəzləmə — `$&`, `$'` kimi ardıcıllıqlar (məs. məhsul adında "$") xüsusi məna daşımasın
  return out.replace('</head>', () => `    ${block}\n  </head>`);
}

async function sitemap(baseUrl) {
  const products = await productService.listProducts({ includeHidden: false, onlyAvailable: true });
  const urls = [
    `<url><loc>${escapeHtml(`${baseUrl}/menyu`)}</loc><changefreq>daily</changefreq><priority>1.0</priority></url>`,
    ...products.map((p) => `<url><loc>${escapeHtml(`${baseUrl}/product/${p.id}`)}</loc><changefreq>weekly</changefreq><priority>0.7</priority></url>`),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  ${urls.join('\n  ')}\n</urlset>\n`;
}

function robots(baseUrl) {
  return [
    'User-agent: *',
    'Allow: /menyu',
    'Allow: /product/',
    'Disallow: /admin',
    'Disallow: /kitchen',
    'Disallow: /cart',
    'Disallow: /order/',
    '',
    `Sitemap: ${baseUrl}/sitemap.xml`,
    '',
  ].join('\n');
}

const clearCache = () => metaCache.clear();

module.exports = { metaForPath, clearCache, injectMeta, sitemap, robots, escapeHtml, safeJson };
