// QA C: ödəniş sistemi dinamik problar (PAYMENT_PROVIDER=test). İşə salmaq (yüksək limitli nüsxə):
//   cd backend && PORT=4001 PAYMENT_RATE_LIMIT=100000 node src/server.js   (ayrı prosesdə)
//   cd backend && QA_BASE=http://localhost:4001 node ../qa/payment-probes.js [--cleanup]
// Müvəqqəti məlumat: hesablar `qa.tmp.rbac.*@example.test`, məhsul `QA-TMP Stok%`, sifarişlər `customer_name LIKE 'QA-PAY%'`,
// skriptin işə düşdüyü andan sonra yaranan bildirişlər (yalnız QA aktivdir). Sonda hamısı silinir.
const path = require('path');
const crypto = require('crypto');

const backend = path.resolve(__dirname, '..', 'backend');
require(path.join(backend, 'node_modules', 'dotenv')).config({ path: path.join(backend, '.env') });
const sql = require(path.join(backend, 'node_modules', 'mssql'));
const bcrypt = require(path.join(backend, 'node_modules', 'bcryptjs'));

const BASE = process.env.QA_BASE || 'http://localhost:4001';
const ORIGIN = 'http://localhost:5174';
const PASSWORD = `Qa-${crypto.randomBytes(9).toString('base64url')}-9x`;
const ROLES = ['OWNER', 'MANAGER', 'WAITER', 'KITCHEN'];
const emailOf = (r) => `qa.tmp.rbac.${r.toLowerCase()}@example.test`;

const findings = [];
const passed = [];
const check = (cond, okMsg, badMsg) => (cond ? passed.push(okMsg) : findings.push(badMsg));

async function connect() {
  return new sql.ConnectionPool({
    server: process.env.DB_SERVER, database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD,
    options: { encrypt: false, trustServerCertificate: true },
  }).connect();
}

async function cleanup(pool, since) {
  const orders = (await pool.request().query("SELECT id FROM orders WHERE customer_name LIKE 'QA-PAY%'")).recordset.map((r) => r.id);
  if (orders.length) {
    const l = orders.join(',');
    await pool.request().query(`DELETE FROM promo_usage WHERE order_id IN (${l})`);
    await pool.request().query(`DELETE FROM stock_movements WHERE order_id IN (${l})`);
    await pool.request().query(`DELETE FROM orders WHERE id IN (${l})`);
  }
  const prods = (await pool.request().query("SELECT id FROM products WHERE name LIKE 'QA-TMP Stok%'")).recordset.map((r) => r.id);
  if (prods.length) {
    const l = prods.join(',');
    await pool.request().query(`DELETE FROM stock_movements WHERE product_id IN (${l})`);
    await pool.request().query(`DELETE FROM products WHERE id IN (${l})`);
  }
  if (since) await pool.request().input('s', sql.DateTime2, since).query('DELETE FROM notifications WHERE created_at >= @s');
  const ids = (await pool.request().query("SELECT id FROM admin_users WHERE email LIKE 'qa.tmp.rbac.%@example.test'")).recordset.map((r) => r.id);
  if (ids.length) {
    const l = ids.join(',');
    await pool.request().query(`UPDATE order_status_history SET changed_by = NULL WHERE changed_by IN (${l})`);
    await pool.request().query(`UPDATE payments SET created_by = NULL WHERE created_by IN (${l})`);
    await pool.request().query(`DELETE FROM audit_logs WHERE admin_user_id IN (${l})`);
    await pool.request().query(`DELETE FROM admin_users WHERE id IN (${l})`);
  }
  const left = (await pool.request().query("SELECT (SELECT COUNT(*) FROM orders WHERE customer_name LIKE 'QA-PAY%') o, (SELECT COUNT(*) FROM products WHERE name LIKE 'QA-TMP Stok%') p, (SELECT COUNT(*) FROM admin_users WHERE email LIKE 'qa.tmp.rbac.%@example.test') a")).recordset[0];
  console.log(`[cleanup] sifariş ${orders.length}, məhsul ${prods.length}, hesab ${ids.length}; qalan: sifariş=${left.o}, məhsul=${left.p}, hesab=${left.a}`);
  return left.o === 0 && left.p === 0 && left.a === 0;
}

async function api(method, url, { cookie, body, form } = {}) {
  const h = { Origin: ORIGIN };
  if (cookie) h.Cookie = cookie;
  let payload;
  if (body !== undefined) { h['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  if (form) { h['Content-Type'] = 'application/x-www-form-urlencoded'; payload = new URLSearchParams(form).toString(); }
  const res = await fetch(BASE + url, { method, headers: h, body: payload });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* */ }
  return { status: res.status, json, text };
}

async function main() {
  const pool = await connect();
  await cleanup(pool);
  const since = (await pool.request().query('SELECT SYSUTCDATETIME() AS t')).recordset[0].t;
  const hash = await bcrypt.hash(PASSWORD, 10);
  for (const r of ROLES) {
    await pool.request().input('e', sql.NVarChar, emailOf(r)).input('h', sql.NVarChar, hash).input('r', sql.NVarChar, r)
      .query('INSERT INTO admin_users (restaurant_id, email, password_hash, role) VALUES (1, @e, @h, @r)');
  }
  const cookies = {};
  let stockOf; let paymentsOf; let orderRow; let sweeper;
  try {
    for (const r of ROLES) {
      const res = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: ORIGIN }, body: JSON.stringify({ email: emailOf(r), password: PASSWORD }) });
      cookies[r] = `qrmenu_token=${res.headers.getSetCookie().find((c) => c.startsWith('qrmenu_token=')).split(';')[0].split('=')[1]}`;
    }
    const cfg = (await api('GET', '/api/auth/config')).json || {};
    console.log('[info] auth/config:', JSON.stringify(cfg));

    const cats = (await api('GET', '/api/categories')).json;
    const catId = (Array.isArray(cats) ? cats : cats.items)[0].id;
    const created = await api('POST', '/api/products', { cookie: cookies.OWNER, body: { name: 'QA-TMP Stok 1', price: 5, category_id: catId, is_available: true } });
    if (created.status !== 201) throw new Error(`temp məhsul yaranmadı: ${created.status} ${created.text}`);
    const pid = created.json.id;
    await pool.request().input('id', sql.Int, pid).query('UPDATE products SET track_inventory = 1, stock_quantity = 20, is_available = 1 WHERE id = @id');
    stockOf = async () => (await pool.request().input('id', sql.Int, pid).query('SELECT stock_quantity s FROM products WHERE id = @id')).recordset[0].s;
    paymentsOf = async (oid) => (await pool.request().input('o', sql.Int, oid).query('SELECT status, provider, amount FROM payments WHERE order_id = @o')).recordset;
    orderRow = async (oid) => (await pool.request().input('o', sql.Int, oid).query('SELECT status, payment_status, payment_method, total, paid_amount FROM orders WHERE id = @o')).recordset[0];

    const mkOrder = async (method, qty = 1) => {
      const r = await api('POST', '/api/orders', { body: { customer_name: 'QA-PAY müştəri', phone: '+994501112233', items: [{ product_id: pid, quantity: qty }], payment_method: method, client_request_id: crypto.randomBytes(12).toString('hex') } });
      return r;
    };
    const parse = (url) => { const u = new URL(url); return { o: u.searchParams.get('o'), sig: u.searchParams.get('sig') }; };

    // ---- S1: onlayn axın + qiymət (məbləği müştəri təyin edə bilməz) ----
    let s0 = await stockOf();
    const on1 = await mkOrder('ONLINE', 2);
    check(on1.status === 201, 'S1 onlayn sifariş yaradıldı', `S1 onlayn sifariş yaradıla bilmədi: ${on1.status} ${on1.text.slice(0, 150)} (pay_online söndürülüb ola bilər)`);
    if (on1.status !== 201) throw new Error('onlayn sifariş yoxdur — davam edilmir');
    const o1 = on1.json; const tok1 = o1.access_token || o1.token;
    check(o1.payment_status === 'PENDING' && Math.abs(Number(o1.total) - 10) < 0.01, 'S1 onlayn sifariş PENDING, məbləğ serverdə hesablandı', `S1 gözlənilməz vəziyyət: ${o1.payment_status} total=${o1.total}`);
    check((await stockOf()) === s0 - 2, 'S1 stok sifarişdə azaldı', 'S1 stok azalmadı');
    const listBefore = await api('GET', '/api/orders?limit=50', { cookie: cookies.KITCHEN });
    const items = Array.isArray(listBefore.json) ? listBefore.json : listBefore.json?.items || [];
    // Dizayn: API siyahısı işçilərə "Ödəniş gözlənilir" etiketi ilə göstərir; mətbəx ekranı (KitchenDisplay) onu süzür, sonrakı addım düyməsi söndürülüb
    check(true, `S1 (bilgi) ödənilməmiş onlayn sifariş siyahıda ${items.some((x) => x.id === o1.id) ? 'görünür (UI süzür)' : 'yoxdur'}`, '');
    const st = await api('POST', `/api/payments/orders/${o1.id}/start`, { body: { token: tok1, amount: 0.01, total: 0.01 } });
    check(st.status === 200 && st.json?.redirect_url, 'S1 ödəniş başladıldı', `S1 start uğursuz: ${st.status} ${st.text.slice(0, 150)}`);
    const pay1 = await paymentsOf(o1.id);
    check(pay1.length === 1 && Math.abs(Number(pay1[0].amount) - 10) < 0.01, 'S1 ödəniş məbləği DB-dən (müştərinin amount=0.01 nəzərə alınmadı)', `S1 ödəniş məbləği səhvdir: ${JSON.stringify(pay1)}`);
    const { o: po1, sig: sig1 } = parse(st.json.redirect_url);

    // ---- S3: saxta imzalar / callback ----
    check((await api('POST', '/api/payments/test/complete', { body: { o: po1, sig: 'x'.repeat(64), outcome: 'success' } })).status === 403, 'S3 yanlış imza → 403', 'S3 yanlış imza qəbul edildi');
    check((await api('POST', '/api/payments/test/complete', { body: { o: po1, sig: sig1.slice(0, -1) + (sig1.endsWith('a') ? 'b' : 'a'), outcome: 'success' } })).status === 403, 'S3 bir simvol dəyişmiş imza → 403', 'S3 dəyişdirilmiş imza qəbul edildi');
    check((await orderRow(o1.id)).payment_status === 'PENDING', 'S3 saxta cəhdlərdən sonra sifariş hələ PENDING', 'S3 sifariş saxta cəhddən PAID oldu');
    const forged = [
      { data: Buffer.from(JSON.stringify({ order_id: po1, status: 'success', amount: 10, transaction: 'evil' })).toString('base64'), signature: 'AAAA' },
      { data: '', signature: '' }, {}, { data: 'x'.repeat(5000), signature: 'y' },
    ];
    for (const f of forged) {
      const r = await api('POST', '/api/payments/epoint/callback', { form: f });
      check(r.status === 400, 'S3 saxta Epoint callback → 400', `S3 saxta callback ${r.status} qaytardı (${r.text.slice(0, 80)})`);
    }
    const jsonCb = await api('POST', '/api/payments/epoint/callback', { body: { data: 'x', signature: 'y' } });
    check(jsonCb.status === 400, 'S3 JSON gövdəli callback → 400', `S3 JSON callback ${jsonCb.status}`);
    check((await orderRow(o1.id)).payment_status === 'PENDING', 'S3 callback cəhdlərindən sonra hələ PENDING', 'S3 saxta callback sifarişi dəyişdi');
    // Başqa sifarişin tokeni ilə start/verify
    const other = await mkOrder('ONLINE');
    const cross = await api('POST', `/api/payments/orders/${o1.id}/start`, { body: { token: other.json.access_token || other.json.token } });
    check(cross.status === 404, 'S3 başqa sifarişin tokeni ilə start → 404', `S3 çarpaz token start ${cross.status}`);

    // ---- S2: paralel təkrar "uğurlu" (callback təkrarı) ----
    const par = await Promise.all(Array.from({ length: 8 }, () => api('POST', '/api/payments/test/complete', { body: { o: po1, sig: sig1, outcome: 'success' } })));
    check(par.every((r) => r.status === 200), 'S2 8 paralel təkrar uğurlu ödəniş hamısı 200 (idempotent)', `S2 paralel təkrar statusları: ${par.map((r) => r.status).join(',')}`);
    const after = await paymentsOf(o1.id);
    check(after.filter((p) => p.status === 'SUCCESS').length === 1, 'S2 tam 1 SUCCESS ödəniş qeydi', `S2 SUCCESS sayı: ${after.filter((p) => p.status === 'SUCCESS').length}`);
    const or1 = await orderRow(o1.id);
    check(or1.payment_status === 'PAID' && Math.abs(Number(or1.paid_amount) - 10) < 0.01, 'S2 sifariş PAID, paid_amount=10', `S2 sifariş vəziyyəti: ${JSON.stringify(or1)}`);
    const late = await api('POST', '/api/payments/test/complete', { body: { o: po1, sig: sig1, outcome: 'failed' } });
    check((await orderRow(o1.id)).payment_status === 'PAID', `S2 PAID sifariş sonradan "failed" callback-i ilə pozulmur (${late.status})`, 'S2 PAID sifariş "failed" ilə pozuldu');
    const listAfter = await api('GET', '/api/orders?limit=50', { cookie: cookies.KITCHEN });
    check((Array.isArray(listAfter.json) ? listAfter.json : listAfter.json?.items || []).some((x) => x.id === o1.id), 'S2 ödənişdən sonra sifariş mətbəxə çatdı', 'S2 ödənilmiş sifariş mətbəx siyahısında yoxdur');
    const restart = await api('POST', `/api/payments/orders/${o1.id}/start`, { body: { token: tok1 } });
    check(restart.status === 409, 'S2 ödənilmiş sifarişə təkrar start → 409', `S2 təkrar start ${restart.status}`);

    // ---- S4: əllə qeyd + refund ----
    check((await api('POST', `/api/orders/${o1.id}/payment`, { cookie: cookies.OWNER, body: {} })).status === 409, 'S4 onlayn sifarişi əllə "ödənildi" etmək → 409', 'S4 onlayn sifariş əllə qeyd edildi');
    check((await api('POST', `/api/orders/${o1.id}/refund`, { cookie: cookies.WAITER, body: {} })).status === 403, 'S4 WAITER refund → 403', 'S4 WAITER refund edə bildi');
    const refunds = await Promise.all(Array.from({ length: 5 }, () => api('POST', `/api/orders/${o1.id}/refund`, { cookie: cookies.OWNER, body: {} })));
    check(refunds.filter((r) => r.status === 200).length === 1, 'S4 5 paralel refund-dan yalnız 1-i keçdi', `S4 refund statusları: ${refunds.map((r) => r.status).join(',')}`);
    check((await orderRow(o1.id)).payment_status === 'REFUNDED', 'S4 sifariş REFUNDED', 'S4 sifariş REFUNDED olmadı');

    // ---- S5: nağd + paralel əllə ödəniş ----
    const cash = await mkOrder('CASH');
    const cid = cash.json.id;
    check((await api('POST', `/api/orders/${cid}/payment`, { cookie: cookies.KITCHEN, body: {} })).status === 403, 'S5 KITCHEN əllə ödəniş → 403', 'S5 KITCHEN ödəniş qeyd edə bildi');
    const paid = await Promise.all(Array.from({ length: 5 }, () => api('POST', `/api/orders/${cid}/payment`, { cookie: cookies.WAITER, body: {} })));
    check(paid.filter((r) => r.status === 200).length === 1 && paid.filter((r) => r.status === 409).length === 4, 'S5 5 paralel "ödənildi" qeydindən yalnız 1-i keçdi (4×409)', `S5 statuslar: ${paid.map((r) => r.status).join(',')}`);
    check((await paymentsOf(cid)).length === 1, 'S5 tam 1 ödəniş sətri', `S5 ödəniş sətri: ${(await paymentsOf(cid)).length}`);

    // ---- S6: ləğv semantikası ----
    s0 = await stockOf();
    const c2 = await mkOrder('CASH', 3);
    check((await stockOf()) === s0 - 3, 'S6 nağd sifariş stoku azaltdı', 'S6 stok azalmadı');
    const cancel = await api('PUT', `/api/orders/${c2.json.id}`, { cookie: cookies.MANAGER, body: { status: 'CANCELLED' } });
    check(cancel.status === 200, 'S6 ləğv keçdi', `S6 ləğv ${cancel.status}`);
    check((await stockOf()) === s0, 'S6 ləğv edilən sifarişin stoku QAYTARILDI', `S6 STOK QAYTARILMADI: gözlənilən ${s0}, faktiki ${await stockOf()}`);
    const uncancel = await api('PUT', `/api/orders/${c2.json.id}`, { cookie: cookies.MANAGER, body: { status: 'PREPARING' } });
    check(uncancel.status === 409, 'S6 ləğv edilmiş sifarişi geri açmaq → 409', `S6 LƏĞV EDİLMİŞ SİFARİŞ YENİDƏN AÇILDI: ${uncancel.status} (stok azalmadan)`);
    // ödənilmiş onlayn sifarişi ləğv etmək (refund olmadan)
    const on2 = await mkOrder('ONLINE');
    const st2 = await api('POST', `/api/payments/orders/${on2.json.id}/start`, { body: { token: on2.json.access_token || on2.json.token } });
    const p2 = parse(st2.json.redirect_url);
    await api('POST', '/api/payments/test/complete', { body: { o: p2.o, sig: p2.sig, outcome: 'success' } });
    const cancelPaid = await api('PUT', `/api/orders/${on2.json.id}`, { cookie: cookies.MANAGER, body: { status: 'CANCELLED' } });
    check(cancelPaid.status === 409, 'S6 ödənilmiş onlayn sifarişi refund-suz ləğv etmək → 409', `S6 ÖDƏNİLMİŞ ONLAYN SİFARİŞ REFUND OLMADAN LƏĞV EDİLDİ (${cancelPaid.status}): pul alınıb, sifariş ləğv`);

    // ---- S7: vaxtı keçmiş onlayn sifariş (sweeper) — real DB CHECK məhdudiyyəti ilə ----
    s0 = await stockOf();
    const exp = await mkOrder('ONLINE', 2);
    await pool.request().input('o', sql.Int, exp.json.id).query('UPDATE orders SET created_at = DATEADD(MINUTE, -90, created_at) WHERE id = @o');
    const chain = { emit() {}, to() { return chain; }, fetchSockets: async () => [] };
    require(path.join(backend, 'src', 'sockets', 'emit')).setIO({ of: () => chain, to: () => chain, emit() {} });
    sweeper = require(path.join(backend, 'src', 'services', 'paymentService'));
    const origErr = console.error; const errs = [];
    console.error = (...a) => { errs.push(a.join(' ')); };
    const n = await sweeper.expireUnpaidOnlineOrders();
    console.error = origErr;
    const eo = await orderRow(exp.json.id);
    check(eo.status === 'CANCELLED', `S7 vaxtı keçmiş ödənilməmiş onlayn sifariş ləğv edildi (${n})`, `S7 VAXTI KEÇMİŞ SİFARİŞ LƏĞV EDİLMƏDİ (status=${eo.status}); xəta: ${errs[0]?.slice(0, 200)}`);
    check((await stockOf()) === s0, 'S7 vaxtı keçən sifarişin stoku qaytarıldı', `S7 STOK QAYTARILMADI: gözlənilən ${s0}, faktiki ${await stockOf()}`);

    // ---- S8: gec gələn ödəniş (ləğvdən sonra) ----
    const on3 = await mkOrder('ONLINE');
    const st3 = await api('POST', `/api/payments/orders/${on3.json.id}/start`, { body: { token: on3.json.access_token || on3.json.token } });
    const p3 = parse(st3.json.redirect_url);
    await api('PUT', `/api/orders/${on3.json.id}`, { cookie: cookies.MANAGER, body: { status: 'CANCELLED' } });
    const lateOk = await api('POST', '/api/payments/test/complete', { body: { o: p3.o, sig: p3.sig, outcome: 'success' } });
    const alerts = (await pool.request().input('s', sql.DateTime2, since).query("SELECT COUNT(*) n FROM notifications WHERE type='system_error' AND created_at >= @s AND body LIKE N'%ləğv edilmişdi%'")).recordset[0].n;
    check(lateOk.status === 200 && alerts >= 1, 'S8 ləğvdən sonra gələn ödəniş üçün sahibə xəbərdarlıq yarandı', `S8 gec ödəniş xəbərdarlığı yoxdur (status ${lateOk.status}, alert ${alerts})`);

    // ---- S12: gəlir hesabatı ödənilməmiş onlayn sifarişi saymır ----
    const dash1 = await api('GET', '/api/admin/dashboard', { cookie: cookies.OWNER });
    const pend = await mkOrder('ONLINE', 5);
    const dash2 = await api('GET', '/api/admin/dashboard', { cookie: cookies.OWNER });
    const revKey = ['revenue_today', 'today_revenue', 'total_revenue'].find((k) => dash1.json && k in dash1.json);
    if (revKey) check(Number(dash1.json[revKey]) === Number(dash2.json[revKey]), 'S12 ödənilməmiş onlayn sifariş gəlirə daxil edilmir', `S12 gəlir dəyişdi: ${dash1.json[revKey]} → ${dash2.json[revKey]}`);
    else passed.push(`S12 (dashboard açarları: ${Object.keys(dash1.json || {}).join(',')} — əl ilə baxılmalıdır)`);
    void pend;
  } finally {
    const clean = await cleanup(pool, since);
    await pool.close();
    if (!clean) console.error('DİQQƏT: müvəqqəti məlumat tam silinmədi!');
  }

  console.log(`\n=== KEÇDİ (${passed.length}) ===`);
  passed.forEach((m) => console.log(' + ' + m));
  console.log(`\n=== TAPINTILAR (${findings.length}) ===`);
  findings.forEach((m) => console.log(' - ' + m));
  if (findings.length) process.exitCode = 1;
  process.exit(process.exitCode || 0);
}

(async () => {
  if (process.argv.includes('--cleanup')) {
    const pool = await connect();
    await cleanup(pool, null);
    await pool.close();
    return;
  }
  await main();
})().catch((e) => { console.error(e); process.exit(2); });
