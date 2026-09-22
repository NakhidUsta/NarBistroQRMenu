// QA K: 300 sifariş yük testi. Bütün sifarişlər `LOADTEST-` prefiksli müştəri adı ilə işarələnir.
//   cd backend && node ../qa/loadtest.js [--cleanup]
// Ardıcıl (50) → paralel dalğalar (10/25/50) → qarışıq (məhsul+kateqoriya CRUD ilə eyni vaxtda) → yarış halları
// (eyni client_request_id paralel, stok tükənməsi) → qiymət manipulyasiyası → real-time → yekun bütövlük yoxlaması.
const path = require('path');
const crypto = require('crypto');
const backend = path.resolve(__dirname, '..', 'backend');
require(path.join(backend, 'node_modules', 'dotenv')).config({ path: path.join(backend, '.env') });
const sql = require(path.join(backend, 'node_modules', 'mssql'));
const bcrypt = require(path.join(backend, 'node_modules', 'bcryptjs'));

const BASE = process.env.QA_BASE || 'http://localhost:4000';
const ORIGIN = 'http://localhost:5174';
const findings = [];
const notes = [];
const bad = (m) => findings.push(m);
const ok = (m) => notes.push(m);

async function connect() {
  return new sql.ConnectionPool({
    server: process.env.DB_SERVER, database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD,
    options: { encrypt: false, trustServerCertificate: true },
  }).connect();
}

async function cleanup(pool) {
  const orders = (await pool.request().query("SELECT id FROM orders WHERE customer_name LIKE 'LOADTEST-%'")).recordset.map((r) => r.id);
  if (orders.length) {
    const l = orders.join(',');
    await pool.request().query(`DELETE FROM promo_usage WHERE order_id IN (${l})`);
    await pool.request().query(`DELETE FROM stock_movements WHERE order_id IN (${l})`);
    await pool.request().query(`DELETE FROM payments WHERE order_id IN (${l})`);
    await pool.request().query(`DELETE FROM notifications WHERE entity_type='order' AND entity_id IN (${l})`).catch(() => {});
    await pool.request().query(`DELETE FROM orders WHERE id IN (${l})`);
  }
  const prod = (await pool.request().query("SELECT id FROM products WHERE name LIKE 'LOADTEST-%'")).recordset.map((r) => r.id);
  if (prod.length) {
    const l = prod.join(',');
    await pool.request().query(`DELETE FROM stock_movements WHERE product_id IN (${l})`);
    await pool.request().query(`DELETE FROM products WHERE id IN (${l})`);
  }
  const ids = (await pool.request().query("SELECT id FROM admin_users WHERE email LIKE 'qa.tmp.rbac.%@example.test'")).recordset.map((r) => r.id);
  if (ids.length) {
    const l = ids.join(',');
    await pool.request().query(`UPDATE order_status_history SET changed_by = NULL WHERE changed_by IN (${l})`);
    await pool.request().query(`DELETE FROM audit_logs WHERE admin_user_id IN (${l})`);
    await pool.request().query(`DELETE FROM admin_users WHERE id IN (${l})`);
  }
  const left = (await pool.request().query("SELECT (SELECT COUNT(*) FROM orders WHERE customer_name LIKE 'LOADTEST-%') o, (SELECT COUNT(*) FROM products WHERE name LIKE 'LOADTEST-%') p")).recordset[0];
  console.log(`[cleanup] sifariş ${orders.length}, məhsul ${prod.length}, hesab ${ids.length}; qalan: sifariş=${left.o}, məhsul=${left.p}`);
  return left.o === 0 && left.p === 0;
}

async function api(method, url, { cookie, body } = {}) {
  const h = { Origin: ORIGIN };
  if (cookie) h.Cookie = cookie;
  let payload;
  if (body !== undefined) { h['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  const t0 = Date.now();
  try {
    const res = await fetch(BASE + url, { method, headers: h, body: payload });
    const text = await res.text();
    let json = null; try { json = JSON.parse(text); } catch { /* */ }
    return { status: res.status, json, text, ms: Date.now() - t0 };
  } catch (err) {
    return { status: 0, json: null, text: err.message, ms: Date.now() - t0, networkError: true };
  }
}

const stats = (arr) => {
  const s = [...arr].sort((a, b) => a - b);
  const p = (q) => s[Math.min(s.length - 1, Math.floor(q * s.length))];
  return { min: s[0], p50: p(0.5), p95: p(0.95), max: s[s.length - 1], avg: (s.reduce((a, b) => a + b, 0) / s.length) || 0 };
};

async function main() {
  const pool = await connect();
  await cleanup(pool);
  const hash = await bcrypt.hash('QaBrowser-9x-Test!', 10);
  await pool.request().input('e', sql.NVarChar, 'qa.tmp.rbac.owner@example.test').input('h', sql.NVarChar, hash)
    .query("INSERT INTO admin_users (restaurant_id, email, password_hash, role) VALUES (1, @e, @h, 'OWNER')");
  const login = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: ORIGIN }, body: JSON.stringify({ email: 'qa.tmp.rbac.owner@example.test', password: 'QaBrowser-9x-Test!' }) });
  const ownerCookie = `qrmenu_token=${login.headers.getSetCookie().find((c) => c.startsWith('qrmenu_token=')).split(';')[0].split('=')[1]}`;

  let productId, trackedId, catId;
  try {
    const cats = (await api('GET', '/api/categories?limit=1')).json;
    catId = (Array.isArray(cats) ? cats : cats.items)[0].id;
    const prodRes = await api('POST', '/api/products', { cookie: ownerCookie, body: { name: 'LOADTEST-Burger', price: 10, category_id: catId } });
    productId = prodRes.json.id;
    const trackRes = await api('POST', '/api/products', { cookie: ownerCookie, body: { name: 'LOADTEST-Limited Stock', price: 5, category_id: catId } });
    trackedId = trackRes.json.id;
    await pool.request().input('id', sql.Int, trackedId).query('UPDATE products SET track_inventory=1, stock_quantity=20, is_available=1 WHERE id=@id');

    const mk = (over = {}) => ({ customer_name: 'LOADTEST-' + crypto.randomBytes(4).toString('hex'), phone: '+994501112233', items: [{ product_id: productId, quantity: 1 }], payment_method: 'CASH', client_request_id: crypto.randomBytes(12).toString('hex'), ...over });

    // ---- K1: ardıcıl 50 ----
    console.log('[K1] ardıcıl 50 sifariş...');
    const seqTimes = [];
    let seqFail = 0;
    for (let i = 0; i < 50; i++) {
      const r = await api('POST', '/api/orders', { body: mk() });
      seqTimes.push(r.ms);
      if (r.status !== 201) seqFail++;
    }
    if (seqFail > 0) bad(`K1: ${seqFail}/50 ardıcıl sifariş uğursuz oldu`);
    else ok(`K1: 50/50 ardıcıl sifariş uğurlu, vaxt: ${JSON.stringify(stats(seqTimes))}ms`);

    // ---- K2: paralel dalğalar 10/25/50 ----
    for (const n of [10, 25, 50]) {
      console.log(`[K2] ${n} paralel sifariş...`);
      const t0 = Date.now();
      const results = await Promise.all(Array.from({ length: n }, () => api('POST', '/api/orders', { body: mk() })));
      const wallMs = Date.now() - t0;
      const fail = results.filter((r) => r.status !== 201);
      const netErr = results.filter((r) => r.networkError);
      if (netErr.length) bad(`K2 (${n} paralel): ${netErr.length} ŞƏBƏKƏ XƏTASI (server çökmüş ola bilər?) — ${netErr[0].text}`);
      else if (fail.length) bad(`K2 (${n} paralel): ${fail.length}/${n} uğursuz — statuslar: ${[...new Set(fail.map((r) => r.status))].join(',')}`);
      else ok(`K2 (${n} paralel): hamısı 201, divar-vaxtı ${wallMs}ms, sorğu vaxtı: ${JSON.stringify(stats(results.map((r) => r.ms)))}ms`);
    }

    // ---- K3: qarışıq ssenari (sifariş yaradılarkən eyni vaxtda admin CRUD) ----
    console.log('[K3] qarışıq ssenari...');
    const mixed = await Promise.all([
      ...Array.from({ length: 20 }, () => api('POST', '/api/orders', { body: mk() })),
      ...Array.from({ length: 10 }, () => api('GET', '/api/products?limit=20')),
      ...Array.from({ length: 5 }, () => api('PATCH', `/api/products/${productId}/availability`, { cookie: ownerCookie, body: { is_available: true } })),
      ...Array.from({ length: 5 }, () => api('GET', '/api/orders?limit=20', { cookie: ownerCookie })),
      api('GET', '/api/health'),
    ]);
    const mixedFail = mixed.filter((r) => r.status === 0 || r.status >= 500);
    if (mixedFail.length) bad(`K3 qarışıq ssenari: ${mixedFail.length} 5xx/şəbəkə xətası`);
    else ok(`K3: ${mixed.length} qarışıq sorğu (sifariş+oxu+admin CRUD) 5xx olmadan tamamlandı`);

    // ---- K4: yarış halları ----
    console.log('[K4] yarış halları...');
    const dupId = crypto.randomBytes(12).toString('hex');
    const dupOrder = mk({ client_request_id: dupId });
    const dupResults = await Promise.all(Array.from({ length: 10 }, () => api('POST', '/api/orders', { body: dupOrder })));
    const dupIds = new Set(dupResults.filter((r) => r.status === 200 || r.status === 201).map((r) => r.json?.id));
    if (dupIds.size !== 1) bad(`K4: eyni client_request_id ilə 10 paralel sorğu ${dupIds.size} FƏRQLİ sifariş yaratdı (1 gözlənilirdi)`);
    else ok('K4: eyni client_request_id ilə 10 paralel sorğu → tam 1 sifariş (idempotent)');

    // stok yarışı: 20 ədəd stokda, 30 paralel sifariş (hər biri 1 ədəd) — ən çox 20-si uğurlu olmalı, mənfi stok olmamalı
    const stockResults = await Promise.all(Array.from({ length: 30 }, () => api('POST', '/api/orders', { body: mk({ items: [{ product_id: trackedId, quantity: 1 }] }) })));
    const stockOk = stockResults.filter((r) => r.status === 201).length;
    const finalStock = (await pool.request().input('id', sql.Int, trackedId).query('SELECT stock_quantity FROM products WHERE id=@id')).recordset[0].stock_quantity;
    if (finalStock < 0) bad(`K4: STOK MƏNFİYƏ DÜŞDÜ: ${finalStock} (30 paralel sifariş, 20 stok)`);
    else if (stockOk > 20) bad(`K4: stokdan çox sifariş qəbul edildi: ${stockOk} uğurlu (stok 20 idi)`);
    else ok(`K4: stok yarışı düzgün idarə olundu — ${stockOk}/30 uğurlu, qalan stok ${finalStock} (mənfi deyil)`);

    // ---- K5: qiymət manipulyasiyası (yük altında) ----
    console.log('[K5] qiymət manipulyasiyası...');
    const priceResults = await Promise.all(Array.from({ length: 10 }, () => api('POST', '/api/orders', { body: mk({ items: [{ product_id: productId, quantity: 1, price: 0.01 }], total: 0.01, subtotal: 0.01, client_request_id: crypto.randomBytes(12).toString('hex') }) })));
    const wrongPrice = priceResults.filter((r) => r.status === 201 && Number(r.json.total) !== 10);
    if (wrongPrice.length) bad(`K5: ${wrongPrice.length} sifariş manipulyasiya edilmiş qiymətlə keçdi`);
    else ok('K5: 10 paralel qiymət-manipulyasiya cəhdinin hamısında server öz qiymətini (10 ₼) istifadə etdi');

    // ---- K6: real-time (yükdən sonra socket hələ işləyir) ----
    console.log('[K6] real-time yoxlaması...');
    const { io: ioClient } = require(path.join(path.resolve(__dirname, '..', 'frontend'), 'node_modules', 'socket.io-client'));
    const admin = ioClient(`${BASE}/admin`, { transports: ['websocket'], extraHeaders: { Cookie: ownerCookie, Origin: ORIGIN } });
    const gotEvent = new Promise((resolve) => { admin.on('order-created', () => resolve(true)); setTimeout(() => resolve(false), 4000); });
    await new Promise((r) => admin.on('connect', r));
    await api('POST', '/api/orders', { body: mk() });
    const received = await gotEvent;
    admin.close();
    if (!received) bad('K6: yükdən sonra admin socket "order-created" hadisəsini almadı');
    else ok('K6: yükdən sonra real-time (socket) hələ işləyir');

    // ---- K7: yükdən sonra panel/sayt cavab verir ----
    console.log('[K7] yükdən sonra ümumi sağlamlıq...');
    const health = await api('GET', '/api/health');
    const menu = await api('GET', '/api/menyu'.replace('menyu', 'products?limit=5'));
    if (health.status !== 200 || menu.status !== 200) bad(`K7: yükdən sonra /health=${health.status}, /products=${menu.status}`);
    else ok(`K7: yükdən sonra API sağlamdır (health ${health.ms}ms, products ${menu.ms}ms)`);
  } finally {
    // ---- Bütövlük yoxlaması: LOADTEST sifarişlərinin cəmi məbləği order_items-lə üst-üstə düşür ----
    const integrity = await pool.request().query(`
      SELECT o.id, o.total, (SELECT SUM(oi.price_at_order * oi.quantity) FROM order_items oi WHERE oi.order_id = o.id) calc
      FROM orders o WHERE o.customer_name LIKE 'LOADTEST-%'`);
    const mismatched = integrity.recordset.filter((r) => Math.abs(Number(r.total) - Number(r.calc || 0)) > 0.01);
    if (mismatched.length) bad(`Bütövlük: ${mismatched.length} sifarişdə total ≠ sətirlərin cəmi (məs #${mismatched[0].id}: total=${mismatched[0].total}, cəm=${mismatched[0].calc})`);
    else ok(`Bütövlük: bütün LOADTEST sifarişlərində (${integrity.recordset.length}) total = sətirlərin cəmi`);

    const clean = await cleanup(pool);
    await pool.close();
    if (!clean) console.error('DİQQƏT: yük testi məlumatı tam silinmədi!');
  }

  console.log(`\n=== QEYDLƏR (${notes.length}) ===`);
  notes.forEach((n) => console.log(' + ' + n));
  console.log(`\n=== TAPINTILAR (${findings.length}) ===`);
  findings.forEach((n) => console.log(' - ' + n));
  if (findings.length) process.exitCode = 1;
  process.exit(process.exitCode || 0);
}

(async () => {
  if (process.argv.includes('--cleanup')) {
    const pool = await connect();
    await cleanup(pool);
    await pool.close();
    return;
  }
  await main();
})().catch((e) => { console.error(e); process.exit(2); });
