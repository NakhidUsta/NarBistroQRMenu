const os = require('os');
const path = require('path');
const fs = require('fs');
const express = require('express');
const request = require('supertest');

jest.mock('../src/config/db', () => ({ sql: jest.requireActual('mssql'), poolPromise: Promise.resolve({}) }));
jest.mock('../src/services/restaurantService');
jest.mock('../src/services/productService');

const restaurantService = require('../src/services/restaurantService');
const productService = require('../src/services/productService');
const seoService = require('../src/services/seoService');
const createSpaRouter = require('../src/routes/spa');

const INDEX = `<!doctype html><html><head>
<title>Köhnə</title>
<meta name="description" content="köhnə" />
<link rel="canonical" href="/menyu" />
<meta property="og:title" content="Köhnə" />
<meta name="twitter:title" content="Köhnə" />
<meta name="viewport" content="width=device-width" />
</head><body><div id="root"></div></body></html>`;

const RESTAURANT = {
  name: 'Savor & Co', about_text: 'Ən dadlı "yemək" <b>burada</b>', logo_url: '/uploads/m-1789815057513-e58f5022.jpg',
  phone: '+994501112233', address: 'Bakı, Nizami 1', instagram_link: 'https://instagram.com/savor', theme: null,
};
const PRODUCT = { id: 7, name: 'Truffle $& Pasta', description: 'Krem sousda', price: 18.5, image_url: 'https://cdn.x/y.jpg', is_available: true };

let distDir;
let app;
beforeAll(() => {
  distDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qrmenu-dist-'));
  fs.mkdirSync(path.join(distDir, 'assets'));
  fs.writeFileSync(path.join(distDir, 'index.html'), INDEX);
  fs.writeFileSync(path.join(distDir, 'assets', 'app-abc123.js'), 'console.log(1)');
  app = express();
  app.use(createSpaRouter(distDir));
});
afterAll(() => fs.rmSync(distDir, { recursive: true, force: true }));
beforeEach(() => {
  seoService.clearCache();
  jest.clearAllMocks();
  restaurantService.getRestaurant.mockResolvedValue(RESTAURANT);
  productService.getProduct.mockImplementation(async (id) => {
    if (id === 7) return PRODUCT;
    throw new Error('yoxdur');
  });
  productService.listProducts.mockResolvedValue([PRODUCT]);
});

describe('SPA + dinamik SEO', () => {
  it('/menyu restoranın adı, təsviri və şəkli ilə OG teqləri yeridir; köhnə teqlər silinir', async () => {
    const res = await request(app).get('/menyu').set('Host', 'menu.example.az');
    expect(res.status).toBe(200);
    expect(res.text).toContain('<title>Savor &amp; Co — Rəqəmsal menyu</title>');
    expect(res.text).toContain('<meta property="og:image" content="http://menu.example.az/uploads/m-1789815057513-e58f5022.jpg" />');
    expect(res.text).toContain('<link rel="canonical" href="http://menu.example.az/menyu" />');
    expect(res.text).not.toContain('Köhnə');
    expect(res.text).toContain('name="viewport"'); // əlaqəsiz teqlər toxunulmaz qalır
    expect(res.text.match(/<title>/g)).toHaveLength(1);
  });

  it('istifadəçi məzmununu HTML-də escape edir (XSS yoxdur)', async () => {
    const res = await request(app).get('/menyu');
    expect(res.text).not.toContain('<b>burada</b>');
    expect(res.text).toContain('&lt;b&gt;burada&lt;/b&gt;');
    expect(res.text).toContain('&quot;yemək&quot;');
  });

  it('JSON-LD Restaurant sxemi var və </script> ilə bloku bağlamaq mümkün deyil', async () => {
    restaurantService.getRestaurant.mockResolvedValue({ ...RESTAURANT, name: 'X</script><script>alert(1)</script>' });
    const res = await request(app).get('/menyu');
    const ld = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(res.text);
    expect(ld).not.toBeNull();
    expect(res.text).not.toContain('<script>alert(1)</script>');
    const parsed = JSON.parse(ld[1]);
    expect(parsed['@type']).toBe('Restaurant');
    expect(parsed.name).toBe('X</script><script>alert(1)</script>');
  });

  it('/product/:id məhsula xas başlıq, qiymət, şəkil və MenuItem JSON-LD verir ("$&" pozmur)', async () => {
    const res = await request(app).get('/product/7').set('Host', 'menu.example.az');
    expect(res.text).toContain('<title>Truffle $&amp; Pasta — Savor &amp; Co</title>');
    expect(res.text).toContain('content="https://cdn.x/y.jpg"');
    expect(res.text).toContain('18.50 ₼');
    expect(res.text).toContain('<link rel="canonical" href="http://menu.example.az/product/7" />');
    const ld = JSON.parse(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(res.text)[1]);
    expect(ld).toMatchObject({ '@type': 'MenuItem', offers: { price: '18.50', priceCurrency: 'AZN' } });
    expect(res.text.match(/<\/head>/g)).toHaveLength(1);
  });

  it('mövcud olmayan məhsul restoran meta-sına düşür (500 yox)', async () => {
    const res = await request(app).get('/product/999');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Savor &amp; Co — Rəqəmsal menyu');
  });

  it('admin/səbət/sifariş səhifələri noindex alır və JSON-LD almır', async () => {
    for (const p of ['/admin/orders', '/cart', '/order/15']) {
      const res = await request(app).get(p);
      expect(res.text).toContain('<meta name="robots" content="noindex, nofollow" />');
      expect(res.text).not.toContain('application/ld+json');
    }
    const pub = await request(app).get('/menyu');
    expect(pub.text).not.toContain('noindex');
  });

  it('PUBLIC_URL təyin olunubsa Host başlığına yox, ona etibar edir', async () => {
    process.env.PUBLIC_URL = 'https://menu.savor.az/';
    try {
      const res = await request(app).get('/menyu').set('Host', 'evil.example');
      expect(res.text).toContain('href="https://menu.savor.az/menyu"');
      expect(res.text).not.toContain('evil.example');
    } finally {
      delete process.env.PUBLIC_URL;
    }
  });

  it('DB xətası olsa statik index.html verilir (səhifə açılır)', async () => {
    restaurantService.getRestaurant.mockRejectedValue(new Error('db down'));
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const res = await request(app).get('/menyu');
    expect(res.status).toBe(200);
    expect(res.text).toContain('<title>Köhnə</title>');
    warn.mockRestore();
  });

  it('meta 15 san keşlənir — ardıcıl sorğular DB-ni təkrar yükləmir', async () => {
    await request(app).get('/menyu').set('Host', 'cache.example.az');
    await request(app).get('/menyu').set('Host', 'cache.example.az');
    expect(restaurantService.getRestaurant).toHaveBeenCalledTimes(1);
  });

  it('/api və /uploads yolları SPA fallback-ə düşmür', async () => {
    const res = await request(app).get('/api/nothing');
    expect(res.status).toBe(404);
    expect(res.text).not.toContain('<div id="root">');
  });

  it('hash-li asset-lər immutable keşlənir, index.html isə no-cache', async () => {
    const asset = await request(app).get('/assets/app-abc123.js');
    expect(asset.headers['cache-control']).toContain('immutable');
    const page = await request(app).get('/menyu');
    expect(page.headers['cache-control']).toBe('no-cache');
  });

  it('sitemap.xml məhsulları DB-dən yaradır; robots.txt sitemap-ə real domeni yazır', async () => {
    const sm = await request(app).get('/sitemap.xml').set('Host', 'menu.example.az');
    expect(sm.headers['content-type']).toContain('xml');
    expect(sm.text).toContain('<loc>http://menu.example.az/product/7</loc>');
    expect(productService.listProducts).toHaveBeenCalledWith({ includeHidden: false, onlyAvailable: true });
    const rb = await request(app).get('/robots.txt').set('Host', 'menu.example.az');
    expect(rb.text).toContain('Sitemap: http://menu.example.az/sitemap.xml');
    expect(rb.text).not.toContain('DOMAIN.com');
  });

  it('favicon admin paneldən təyin olunubsa köhnə ikon əvəzlənir, yoxdursa standart ikon qalır', async () => {
    const withIcon = await request(app).get('/menyu').set('Host', 'menu.example.az');
    expect(withIcon.text).toContain('href="/favicon.svg"'); // təyin olunmayıb → standart
    expect(withIcon.text.match(/rel="icon"/g)).toHaveLength(1);

    seoService.clearCache();
    restaurantService.getRestaurant.mockResolvedValue({ ...RESTAURANT, favicon_url: '/uploads/m-1789815057513-aaaaaaaa.png' });
    const res = await request(app).get('/product/7').set('Host', 'menu.example.az');
    expect(res.text).toContain('<link rel="icon" href="http://menu.example.az/uploads/m-1789815057513-aaaaaaaa.png" />');
    expect(res.text).not.toContain('/favicon.svg');
    expect(res.text.match(/rel="icon"/g)).toHaveLength(1);
  });

  it('dist yoxdursa router heç nə etmir (dev rejimi)', async () => {
    const dev = express();
    dev.use(createSpaRouter(path.join(os.tmpdir(), 'yoxdur-' + Date.now())));
    const res = await request(dev).get('/menyu');
    expect(res.status).toBe(404);
  });
});
