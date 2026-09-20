// QA: dinamik təhlükəsizlik problari (məlumat sızması, injection/fuzz, mass assignment, sifariş IDOR, fayl yükləmə, socket).
// İşə salmaq: cd backend && node ../qa/probes.js [--cleanup]   (QA_BASE=http://localhost:4001 ilə yüksək limitli nüsxəyə qarşı)
// Müvəqqəti məlumat: hesab `qa.tmp.rbac.owner@example.test`, sifarişlər `customer_name LIKE 'QA-PROBE%'`, yüklənən media (özü silir).
const path = require('path');
const crypto = require('crypto');
const fsp = require('fs/promises');

const backend = path.resolve(__dirname, '..', 'backend');
const frontend = path.resolve(__dirname, '..', 'frontend');
require(path.join(backend, 'node_modules', 'dotenv')).config({ path: path.join(backend, '.env') });
const sql = require(path.join(backend, 'node_modules', 'mssql'));
const bcrypt = require(path.join(backend, 'node_modules', 'bcryptjs'));
const { io: ioClient } = require(path.join(frontend, 'node_modules', 'socket.io-client'));

const BASE = process.env.QA_BASE || 'http://localhost:4000';
const ORIGIN = 'http://localhost:5174';
const OWNER_EMAIL = 'qa.tmp.rbac.owner@example.test';
const PASSWORD = `Qa-${crypto.randomBytes(9).toString('base64url')}-9x`;

const findings = [];
const ok = [];
const bad = (m) => findings.push(m);
const good = (m) => ok.push(m);

async function connect() {
  return new sql.ConnectionPool({
    server: process.env.DB_SERVER, database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD,
    options: { encrypt: false, trustServerCertificate: true },
  }).connect();
}

async function cleanup(pool) {
  const orders = (await pool.request().query("SELECT id FROM orders WHERE customer_name LIKE 'QA-PROBE%'")).recordset.map((r) => r.id);
  if (orders.length) {
    const l = orders.join(',');
    await pool.request().query(`DELETE FROM promo_usage WHERE order_id IN (${l})`);
    await pool.request().query(`DELETE FROM stock_movements WHERE order_id IN (${l})`);
    await pool.request().query(`DELETE FROM notifications WHERE entity_type = 'order' AND entity_id IN (${l})`).catch(() => {});
    await pool.request().query(`DELETE FROM orders WHERE id IN (${l})`);
  }
  const ids = (await pool.request().query("SELECT id FROM admin_users WHERE email LIKE 'qa.tmp.rbac.%@example.test'")).recordset.map((r) => r.id);
  if (ids.length) {
    const l = ids.join(',');
    await pool.request().query(`UPDATE order_status_history SET changed_by = NULL WHERE changed_by IN (${l})`);
    await pool.request().query(`DELETE FROM audit_logs WHERE admin_user_id IN (${l})`);
    await pool.request().query(`DELETE FROM admin_users WHERE id IN (${l})`);
  }
  const left = (await pool.request().query("SELECT (SELECT COUNT(*) FROM orders WHERE customer_name LIKE 'QA-PROBE%') o, (SELECT COUNT(*) FROM admin_users WHERE email LIKE 'qa.tmp.rbac.%@example.test') a")).recordset[0];
  console.log(`[cleanup] silinən sifariş: ${orders.length}, hesab: ${ids.length}; qalan sifariş=${left.o}, hesab=${left.a}`);
  return left.o === 0 && left.a === 0;
}

async function req(method, url, { cookie, body, headers = {}, raw, ctype } = {}) {
  const h = { Origin: ORIGIN, ...headers };
  if (cookie) h.Cookie = cookie;
  let payload = raw;
  if (body !== undefined) { h['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  if (ctype) h['Content-Type'] = ctype;
  const res = await fetch(BASE + url, { method, headers: h, body: payload, redirect: 'manual' });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not json */ }
  return { status: res.status, headers: res.headers, text, json };
}

const LEAK_RE = /(at\s+\S+\s+\(.*:\d+:\d+\)|node_modules|Incorrect syntax|Unclosed quotation|mssql|RequestError|ConnectionError|SELECT\s.+FROM|C:\\Users|stack)/i;

async function main() {
  const pool = await connect();
  await cleanup(pool);
  await pool.request().input('h', sql.NVarChar, await bcrypt.hash(PASSWORD, 10)).input('e', sql.NVarChar, OWNER_EMAIL)
    .query("INSERT INTO admin_users (restaurant_id, email, password_hash, role) VALUES (1, @e, @h, 'OWNER')");
  const createdMedia = [];
  let ownerCookie;
  try {
    const login = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: ORIGIN }, body: JSON.stringify({ email: OWNER_EMAIL, password: PASSWORD }) });
    ownerCookie = `qrmenu_token=${login.headers.getSetCookie().find((c) => c.startsWith('qrmenu_token=')).split(';')[0].split('=')[1]}`;
    const loginJson = await login.clone().json().catch(() => ({}));
    if (JSON.stringify(loginJson).match(/access_token|"token"|password_hash/i)) bad(`Login cavabı token/hash sahəsi daşıyır: ${Object.keys(loginJson).join(',')}`);
    else good('Login cavab gövdəsində token/password_hash yoxdur');

    // ---- P1: məlumat sızması ----
    const health = await req('GET', '/api/health');
    if (health.json && (health.json.uptime_s !== undefined || health.json.sockets)) bad(`/api/health girişsiz uptime/socket statistikası açır: ${Object.keys(health.json).join(',')}`);
    const probes = [
      ['GET', '/api/nonexistent'], ['GET', '/api/products/abc'], ['GET', '/api/orders/abc'], ['GET', '/api/products/1e999'],
      ['POST', '/api/auth/login', { raw: '{"email":', ctype: 'application/json' }],
      ['POST', '/api/orders', { raw: '{bad json', ctype: 'application/json' }],
      ['POST', '/api/orders', { raw: 'x'.repeat(300 * 1024), ctype: 'application/json' }],
      ['POST', '/api/orders', { raw: 'a=1', ctype: 'application/x-www-form-urlencoded' }],
      ['GET', '/.env'], ['GET', '/backend/.env'], ['GET', '/uploads/../.env'], ['GET', '/uploads/..%2f..%2f.env'], ['GET', '/uploads/%2e%2e/%2e%2e/.env'],
      ['GET', '/uploads/'], ['GET', '/api/../.env'], ['GET', '/package.json'], ['GET', '/backend/package.json'],
      ['GET', '/uploads/..%5c..%5c.env'], ['GET', '/uploads/%00.png'],
    ];
    for (const [m, u, o] of probes) {
      const r = await req(m, u, o || {});
      const tag = `${m} ${u.slice(0, 40)}`;
      if (r.status >= 500) bad(`5xx cavab: ${tag} → ${r.status}`);
      if (LEAK_RE.test(r.text) && r.status !== 200) bad(`Xəta cavabı daxili detal ehtiva edir: ${tag} → ${r.text.slice(0, 120)}`);
      if (/\.env|package\.json/.test(u) && r.status === 200 && /JWT_SECRET|DB_PASSWORD|"dependencies"/.test(r.text)) bad(`FAYL SIZDI: ${u}`);
      if (r.headers.get('x-powered-by')) bad(`X-Powered-By açıqdır: ${tag}`);
    }
    good('Xəta/traversal/böyük gövdə probları tamamlandı (yuxarıdakı tapıntılar istisna)');

    // ---- P2: injection/fuzz (public GET) ----
    const sqli = ["' OR 1=1--", "1; DROP TABLE orders--", "' UNION SELECT password_hash FROM admin_users--", "%' AND 1=CONVERT(int,(SELECT TOP 1 email FROM admin_users))--", '\\', '0x41', '9'.repeat(40), '-1', '\u0000', '{"$ne":null}', '<script>alert(1)</script>', '../../etc/passwd'];
    for (const p of sqli) {
      const enc = encodeURIComponent(p);
      for (const u of [`/api/products?q=${enc}`, `/api/products?category_id=${enc}`, `/api/products?limit=${enc}`, `/api/products?before=${enc}`, `/api/categories?limit=${enc}`, `/api/products/${enc}`, `/api/tables/${enc}/scan`, `/api/reviews/public?limit=${enc}`, `/api/allergens?x=${enc}`]) {
        const r = await req(u.includes('/scan') ? 'POST' : 'GET', u, u.includes('/scan') ? { body: { token: p } } : {});
        if (r.status >= 500) bad(`5xx (injection probu): ${u.slice(0, 70)} → ${r.status} ${r.text.slice(0, 100)}`);
        else if (r.status >= 400 && LEAK_RE.test(r.text)) bad(`Sızma (injection probu): ${u.slice(0, 70)} → ${r.text.slice(0, 120)}`);
        if (/admin@|password_hash|\$2[aby]\$/.test(r.text)) bad(`UNION/DATA SIZMASI: ${u.slice(0, 70)}`);
      }
      const o = await req('GET', `/api/orders?q=${enc}&status=${enc}&date=${enc}`, { cookie: ownerCookie });
      if (o.status >= 500 || (o.status >= 400 && LEAK_RE.test(o.text))) bad(`Admin sifariş filtri injection: ${p.slice(0, 20)} → ${o.status} ${o.text.slice(0, 100)}`);
    }
    good(`${sqli.length * 10} injection/fuzz sorğusu (public + admin filtrlər) 5xx/sızma olmadan cavablandı (yuxarıdakı tapıntılar istisna)`);

    // ---- P3: mass assignment + qiymət/məbləğ etibarı + P4: IDOR ----
    const prods = (await req('GET', '/api/products?limit=20')).json;
    const list = Array.isArray(prods) ? prods : prods?.items || [];
    const product = list.find((p) => p.is_available && Number(p.price) > 0) || list[0];
    if (!product) throw new Error('məhsul tapılmadı');
    const mk = (extra = {}) => ({ customer_name: 'QA-PROBE müştəri', phone: '+994501112233', items: [{ product_id: product.id, quantity: 1 }], payment_method: 'CASH', client_request_id: crypto.randomBytes(12).toString('hex'), ...extra });

    const evil = mk({ status: 'COMPLETED', payment_status: 'PAID', total: 0.01, subtotal: 0.01, price: 0.01, id: 1, restaurant_id: 99, is_admin: true, paid_at: '2020-01-01', refunded_at: '2020-01-01', items: [{ product_id: product.id, quantity: 1, price: 0.01, price_at_order: 0.01 }] });
    const o1 = await req('POST', '/api/orders', { body: evil });
    if (o1.status !== 201) bad(`Sifariş yaradıla bilmədi (mass-assign probu): ${o1.status} ${o1.text.slice(0, 150)}`);
    else {
      const ord = o1.json;
      const total = Number(ord.total);
      if (ord.status !== 'NEW') bad(`MASS-ASSIGNMENT: status müştəridən qəbul edildi → ${ord.status}`);
      if (ord.payment_status && ord.payment_status !== 'UNPAID') bad(`MASS-ASSIGNMENT: payment_status müştəridən qəbul edildi → ${ord.payment_status}`);
      if (Math.abs(total - Number(product.price)) > 0.001) bad(`QİYMƏT ETİBARI: server məbləği ${total}, məhsul qiyməti ${product.price}`);
      if (Number(ord.restaurant_id) === 99 || Number(ord.id) === 1) bad('MASS-ASSIGNMENT: id/restaurant_id müştəridən qəbul edildi');
      if (ord.paid_at) bad('MASS-ASSIGNMENT: paid_at müştəridən qəbul edildi');
      if (!ord.access_token && !ord.token) good('Sifariş cavabında token açıq sahə kimi görünmür (adı fərqli ola bilər)');
      const token = ord.access_token || ord.token || ord.public_token;

      // IDOR
      const anon = await req('GET', `/api/orders/${ord.id}`);
      if (anon.status === 200) bad(`IDOR: tokensiz GET /api/orders/${ord.id} → 200 (PII: ${Object.keys(anon.json || {}).join(',')})`);
      const wrong = await req('GET', `/api/orders/${ord.id}?token=${'0'.repeat(32)}`);
      if (wrong.status === 200) bad('IDOR: yanlış tokenlə sifariş açıldı');
      if (token) {
        const right = await req('GET', `/api/orders/${ord.id}?token=${encodeURIComponent(token)}`);
        if (right.status !== 200) bad(`Düzgün tokenlə sifariş açılmır: ${right.status}`);
        for (const [m, u, b] of [['POST', `/api/payments/orders/${ord.id}/start`, {}], ['POST', `/api/payments/orders/${ord.id}/verify`, {}], ['POST', `/api/reviews/order/${ord.id}`, { rating: 5 }], ['GET', `/api/reviews/order/${ord.id}`]]) {
          const r = await req(m, u, { body: b });
          if (r.status === 200 && m === 'GET') bad(`IDOR: tokensiz ${m} ${u} → 200 ${r.text.slice(0, 80)}`);
          if (r.status === 200 && m === 'POST') bad(`IDOR: tokensiz ${m} ${u} → 200`);
          if (r.status >= 500) bad(`5xx: ${m} ${u} → ${r.status}`);
        }
      }
      // idempotent təkrar sorğu başqa gövdə ilə: eyni client_request_id başqasının sifarişini qaytarmamalıdır
      const replay = await req('POST', '/api/orders', { body: { ...evil, customer_name: 'QA-PROBE başqa şəxs', phone: '+994559998877' } });
      if (replay.status === 200 && replay.json && (replay.json.customer_name === 'QA-PROBE müştəri')) good('Təkrar client_request_id eyni sifarişi qaytarır (idempotent; müştərinin öz açarıdır)');
    }
    const neg = await req('POST', '/api/orders', { body: mk({ items: [{ product_id: product.id, quantity: -5 }] }) });
    if (neg.status === 201) bad('Mənfi miqdarla sifariş yaradıldı');
    const big = await req('POST', '/api/orders', { body: mk({ items: [{ product_id: product.id, quantity: 1e9 }], client_request_id: crypto.randomBytes(12).toString('hex') }) });
    if (big.status !== 400) bad(`1e9 miqdarla sifariş → ${big.status} (400 gözlənilirdi)`);
    const hugeId = await req('GET', '/api/products/9999999999999999999999999999999999999999');
    if (hugeId.status !== 400 && hugeId.status !== 404) bad(`Nəhəng ID → ${hugeId.status}`);
    const many = await req('POST', '/api/orders', { body: mk({ items: Array.from({ length: 500 }, () => ({ product_id: product.id, quantity: 1 })), client_request_id: crypto.randomBytes(12).toString('hex') }) });
    if (many.status === 201) bad('500 sətirli sifariş yaradıldı (sətir limiti yoxdur)');
    const proto = await req('POST', '/api/orders', { raw: '{"__proto__":{"isAdmin":true},"constructor":{"prototype":{"x":1}},"customer_name":"QA-PROBE proto","phone":"+994501112233","items":[{"product_id":' + product.id + ',"quantity":1}],"client_request_id":"' + crypto.randomBytes(12).toString('hex') + '"}', ctype: 'application/json' });
    if (proto.status >= 500) bad(`__proto__ gövdəsi 5xx verdi: ${proto.status}`);
    const longName = await req('POST', '/api/orders', { body: mk({ customer_name: 'QA-PROBE ' + 'A'.repeat(5000), client_request_id: crypto.randomBytes(12).toString('hex') }) });
    if (longName.status >= 500) bad(`Uzun ad → ${longName.status}`);
    else if (longName.status === 201) bad('5000 simvollu müştəri adı qəbul edildi (uzunluq limiti yoxdur)');
    const xssName = await req('POST', '/api/orders', { body: mk({ customer_name: 'QA-PROBE <img src=x onerror=alert(1)>', note: '<script>alert(1)</script>', client_request_id: crypto.randomBytes(12).toString('hex') }) });
    if (xssName.status >= 500) bad(`XSS adlı sifariş → ${xssName.status}`);
    good('Mənfi/dəhşətli/500-sətir/__proto__/uzun/XSS sifariş probları icra olundu (tapıntılar yuxarıda)');

    // ---- P5: fayl yükləmə (OWNER ilə) ----
    const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
    const cases = [
      { name: 'html-as-png.png', type: 'image/png', data: Buffer.from('<html><script>alert(document.domain)</script></html>'), expect: 'reject' },
      { name: 'evil.svg', type: 'image/svg+xml', data: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'), expect: 'reject' },
      { name: 'shell.php.png', type: 'image/png', data: Buffer.from('<?php system($_GET["c"]); ?>'), expect: 'reject' },
      { name: 'x.html', type: 'image/png', data: PNG, expect: 'accept-safe-ext' },
      { name: '../../evil.png', type: 'image/png', data: PNG, expect: 'accept-safe-path' },
      { name: 'poly.png', type: 'image/png', data: Buffer.concat([PNG, Buffer.from('<script>alert(1)</script>')]), expect: 'either' },
      { name: 'big.png', type: 'image/png', data: Buffer.concat([PNG, Buffer.alloc(6 * 1024 * 1024)]), expect: 'reject' },
      { name: 'x.exe', type: 'application/octet-stream', data: Buffer.from('MZ\x90\x00'), expect: 'reject' },
    ];
    for (const c of cases) {
      const fd = new FormData();
      fd.append('image', new Blob([c.data], { type: c.type }), c.name);
      const res = await fetch(`${BASE}/api/upload`, { method: 'POST', headers: { Origin: ORIGIN, Cookie: ownerCookie }, body: fd });
      const txt = await res.text();
      let j = null; try { j = JSON.parse(txt); } catch { /* */ }
      if (res.status >= 500) bad(`Yükləmə 5xx: ${c.name} → ${res.status} ${txt.slice(0, 100)}`);
      if (j?.media?.id) createdMedia.push(j.media.id);
      if (c.expect === 'reject' && res.status === 201) bad(`YÜKLƏMƏ: təhlükəli fayl qəbul edildi: ${c.name} → ${j?.url}`);
      if (res.status === 201) {
        const url = j.url || '';
        if (/\.(html?|php|svg|exe|js)(\?|$)/i.test(url) || url.includes('..')) bad(`YÜKLƏMƏ: saxlanan ad təhlükəlidir: ${c.name} → ${url}`);
        const served = await fetch(BASE + url);
        const ct = served.headers.get('content-type') || '';
        if (/html|svg|javascript|xml/i.test(ct)) bad(`YÜKLƏMƏ: fayl ${ct} kimi xidmət olunur: ${url}`);
        const body = Buffer.from(await served.arrayBuffer()).toString('latin1');
        if (body.includes('<script>')) bad(`YÜKLƏMƏ: saxlanmış faylda <script> qalıb (${c.name} → ${url})`);
      }
    }
    good('8 fayl yükləmə probu (saxta MIME, SVG, PHP, traversal, polyglot, 6MB, .exe) icra olundu');

    // ---- P6: socket ----
    const events = [];
    const pub = ioClient(BASE, { transports: ['websocket'], query: { table: 'table_001' }, extraHeaders: { Origin: ORIGIN } });
    await new Promise((r) => { pub.on('connect', r); pub.on('connect_error', r); setTimeout(r, 4000); });
    pub.onAny((ev, data) => events.push({ ev, data }));
    const joinWrong = await new Promise((r) => { pub.emit('join-order', { id: 1, token: 'x'.repeat(32) }, r); setTimeout(() => r('timeout'), 3000); });
    if (joinWrong && joinWrong.ok) bad('SOCKET: yanlış tokenlə join-order uğurlu oldu');
    const joinNoTok = await new Promise((r) => { pub.emit('join-order', 1, r); setTimeout(() => r('timeout'), 3000); });
    if (joinNoTok && joinNoTok.ok) bad('SOCKET: tokensiz join-order uğurlu oldu');
    const adminAnon = ioClient(`${BASE}/admin`, { transports: ['websocket'], extraHeaders: { Origin: ORIGIN } });
    const adminRes = await new Promise((r) => { adminAnon.on('connect', () => r('CONNECTED')); adminAnon.on('connect_error', (e) => r('rejected:' + e.message)); setTimeout(() => r('timeout'), 4000); });
    if (adminRes === 'CONNECTED') bad('SOCKET: /admin namespace girişsiz qoşulmağa icazə verdi');
    adminAnon.close();
    // yeni sifariş yaradılanda public socket PII almamalıdır
    const trigger = await req('POST', '/api/orders', { body: mk({ customer_name: 'QA-PROBE socket', client_request_id: crypto.randomBytes(12).toString('hex') }) });
    await new Promise((r) => setTimeout(r, 1500));
    const leaked = events.filter((e) => /phone|customer_name|access_token|token/i.test(JSON.stringify(e.data || {})));
    if (leaked.length) bad(`SOCKET: public klient PII/token aldı: ${JSON.stringify(leaked[0]).slice(0, 200)}`);
    else good(`Public socket ${events.length} hadisə aldı, PII/token yoxdur (${events.map((e) => e.ev).join(',') || '—'})`);
    if (trigger.status !== 201) bad(`Socket triggeri sifarişi yaranmadı: ${trigger.status}`);
    pub.close();
  } finally {
    // yüklənən media-nı sil (API ilə: fayl + variantlar da silinir)
    for (const id of createdMedia) await req('DELETE', `/api/media/${id}`, { cookie: ownerCookie }).catch(() => {});
    // sifarişləri ləğv et (stok qaytarılsın), sonra sil
    const rows = (await pool.request().query("SELECT id, status FROM orders WHERE customer_name LIKE 'QA-PROBE%'")).recordset;
    for (const o of rows) if (ownerCookie && o.status !== 'CANCELLED') await req('PUT', `/api/orders/${o.id}`, { cookie: ownerCookie, body: { status: 'CANCELLED', note: 'QA probe' } }).catch(() => {});
    const clean = await cleanup(pool);
    await pool.close();
    if (!clean) console.error('DİQQƏT: müvəqqəti məlumat tam silinmədi!');
  }

  console.log('\n=== OK ===');
  ok.forEach((m) => console.log(' + ' + m));
  console.log(`\n=== TAPINTILAR (${findings.length}) ===`);
  findings.forEach((m) => console.log(' - ' + m));
  if (findings.length) process.exitCode = 1;
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
