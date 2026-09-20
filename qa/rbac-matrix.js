// QA: dinamik rol (RBAC) matrisi. İşə salmaq: cd backend && node ../qa/rbac-matrix.js [--cleanup]
// 4 müvəqqəti hesab (OWNER/MANAGER/WAITER/KITCHEN) yaradır, hər endpoint-i hər rolla və girişsiz çağırır,
// nəticəni GÖZLƏNİLƏN icazə cədvəli ilə müqayisə edir. Sonda hesabları silir (--cleanup tək başına da silir).
// Dağıdıcı endpoint-lər (`destructive`) yalnız İCAZƏSİZ rollarla yoxlanılır (icazəli rolla real məlumatı pozmasın).
const path = require('path');
const crypto = require('crypto');

const backend = path.resolve(__dirname, '..', 'backend');
require(path.join(backend, 'node_modules', 'dotenv')).config({ path: path.join(backend, '.env') });
const sql = require(path.join(backend, 'node_modules', 'mssql'));
const bcrypt = require(path.join(backend, 'node_modules', 'bcryptjs'));

const BASE = process.env.QA_BASE || 'http://localhost:4000';
const ORIGIN = 'http://localhost:5174';
const ROLES = ['OWNER', 'MANAGER', 'WAITER', 'KITCHEN'];
const emailOf = (role) => `qa.tmp.rbac.${role.toLowerCase()}@example.test`;
const PASSWORD = `Qa-${crypto.randomBytes(9).toString('base64url')}-9x`;

async function connect() {
  return new sql.ConnectionPool({
    server: process.env.DB_SERVER, database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD,
    options: { encrypt: false, trustServerCertificate: true },
  }).connect();
}

async function cleanup(pool) {
  const like = 'qa.tmp.rbac.%@example.test';
  const ids = (await pool.request().input('e', sql.NVarChar, like).query('SELECT id FROM admin_users WHERE email LIKE @e')).recordset.map((r) => r.id);
  if (ids.length) {
    const list = ids.join(',');
    await pool.request().query(`UPDATE order_status_history SET changed_by = NULL WHERE changed_by IN (${list})`);
    await pool.request().query(`DELETE FROM audit_logs WHERE admin_user_id IN (${list})`);
    await pool.request().query(`DELETE FROM admin_users WHERE id IN (${list})`);
  }
  const left = (await pool.request().input('e', sql.NVarChar, like).query('SELECT COUNT(*) n FROM admin_users WHERE email LIKE @e')).recordset[0].n;
  console.log(`[cleanup] silinən hesab: ${ids.length}, qalan: ${left}`);
  return left === 0;
}

function cookieFrom(res, name) {
  const all = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
  const hit = all.find((c) => c.startsWith(`${name}=`));
  return hit ? hit.split(';')[0].slice(name.length + 1) : null;
}

async function call(method, url, { cookie, body, headers = {} } = {}) {
  const h = { Origin: ORIGIN, ...headers };
  if (cookie) h.Cookie = cookie;
  let payload;
  if (body !== undefined) { h['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  const res = await fetch(BASE + url, { method, headers: h, body: payload, redirect: 'manual' });
  return res.status;
}

// [metod, yol, icazəli rollar ('ANY' = hər hansı admin), seçimlər]
const OM = ['OWNER', 'MANAGER'];
const STAFF = ['OWNER', 'MANAGER', 'WAITER'];
const ALL = ['OWNER', 'MANAGER', 'WAITER', 'KITCHEN'];
const X = { destructive: true };
const MATRIX = [
  ['GET', '/api/admin/dashboard', OM],
  ['GET', '/api/audit-logs', OM],
  ['GET', '/api/staff', ['OWNER']],
  ['POST', '/api/staff', ['OWNER'], { body: {} }],
  ['PUT', '/api/staff/999999', ['OWNER'], { body: { role: 'WAITER' } }],
  ['DELETE', '/api/staff/999999', ['OWNER']],
  ['GET', '/api/mail-settings', ['OWNER']],
  ['PUT', '/api/mail-settings', ['OWNER'], { body: {}, ...X }],
  ['DELETE', '/api/mail-settings', ['OWNER'], X],
  ['POST', '/api/mail-settings/test', ['OWNER'], { body: {}, ...X }],
  ['POST', '/api/auth/test-mail', ['OWNER'], { body: {}, ...X }],
  ['GET', '/api/insights/customers', OM],
  ['GET', '/api/insights/inventory', OM],
  ['GET', '/api/insights/reports/orders.csv', OM],
  ['GET', '/api/insights/reports/products.csv', OM],
  ['GET', '/api/media', OM],
  ['POST', '/api/media/999999/crop', OM, { body: {} }],
  ['DELETE', '/api/media/999999', OM],
  ['POST', '/api/upload', OM],
  ['GET', '/api/promos', OM],
  ['POST', '/api/promos', OM, { body: {} }],
  ['PUT', '/api/promos/999999', OM, { body: {} }],
  ['DELETE', '/api/promos/999999', OM],
  ['GET', '/api/reviews', OM],
  ['PATCH', '/api/reviews/999999', OM, { body: {} }],
  ['DELETE', '/api/reviews/999999', OM],
  ['PUT', '/api/restaurant', OM, { body: {}, ...X }],
  ['POST', '/api/categories', OM, { body: {} }],
  ['PUT', '/api/categories/999999', OM, { body: {} }],
  ['DELETE', '/api/categories/999999', OM],
  ['POST', '/api/products', OM, { body: {} }],
  ['PUT', '/api/products/999999', OM, { body: {} }],
  ['PATCH', '/api/products/999999/availability', ['OWNER', 'MANAGER', 'KITCHEN'], { body: { is_available: true } }],
  ['PATCH', '/api/products/999999/visibility', OM, { body: {} }],
  ['PATCH', '/api/products/999999/stock', OM, { body: {} }],
  ['DELETE', '/api/products/999999', OM],
  ['GET', '/api/tables', STAFF],
  ['GET', '/api/tables/999999', STAFF],
  ['POST', '/api/tables', OM, { body: {} }],
  ['PUT', '/api/tables/999999', OM, { body: {} }],
  ['POST', '/api/tables/999999/regenerate', OM],
  ['DELETE', '/api/tables/999999', OM],
  ['GET', '/api/notifications', STAFF],
  ['PATCH', '/api/notifications/read-all', STAFF, X],
  ['PATCH', '/api/notifications/999999/status', STAFF, { body: {} }],
  ['PATCH', '/api/notifications/999999/read', STAFF],
  ['DELETE', '/api/notifications/read', STAFF, X],
  ['DELETE', '/api/notifications/999999', STAFF],
  ['GET', '/api/orders', 'ANY'],
  ['GET', '/api/orders/999999/payments', 'ANY'],
  ['POST', '/api/orders/999999/payment', STAFF, { body: {} }],
  ['POST', '/api/orders/999999/refund', OM, { body: {} }],
  ['PUT', '/api/orders/999999', ALL, { body: { status: 'CONFIRMED' } }],
  ['POST', '/api/ingredients', OM, { body: {} }],
  ['PUT', '/api/ingredients/999999', OM, { body: {} }],
  ['DELETE', '/api/ingredients/999999', OM],
  ['GET', '/api/auth/me', 'ANY'],
  ['GET', '/api/auth/sessions', 'ANY'],
  ['POST', '/api/auth/send-verification', 'ANY', X],
  ['POST', '/api/auth/change-password', 'ANY', { body: {}, ...X }],
  ['POST', '/api/auth/change-email', 'ANY', { body: {}, ...X }],
];

const results = { checked: 0, bad: [], notes: [] };
function verdict(label, status, shouldPass) {
  results.checked++;
  const blocked = status === 401 || status === 403;
  if (shouldPass && blocked) results.bad.push(`YANLIŞ-RƏDD ${label} → ${status}`);
  if (!shouldPass && !blocked) results.bad.push(`KEÇİD (BYPASS) ${label} → ${status}`);
}

async function run() {
  const pool = await connect();
  await cleanup(pool);
  const hash = await bcrypt.hash(PASSWORD, 10);
  for (const role of ROLES) {
    await pool.request().input('e', sql.NVarChar, emailOf(role)).input('h', sql.NVarChar, hash).input('r', sql.NVarChar, role)
      .query('INSERT INTO admin_users (restaurant_id, email, password_hash, role) VALUES (1, @e, @h, @r)');
  }
  console.log('[setup] 4 müvəqqəti hesab yaradıldı');

  try {
    const cookies = {};
    const refreshes = {};
    for (const role of ROLES) {
      const res = await fetch(`${BASE}/api/auth/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
        body: JSON.stringify({ email: emailOf(role), password: PASSWORD }),
      });
      if (res.status !== 200) throw new Error(`${role} giriş alınmadı: ${res.status} ${await res.text()}`);
      cookies[role] = `qrmenu_token=${cookieFrom(res, 'qrmenu_token')}`;
      const all = res.headers.getSetCookie();
      const rc = all.find((c) => !c.startsWith('qrmenu_token='));
      refreshes[role] = rc ? rc.split(';')[0].split('=').slice(1).join('=') : null;
    }
    console.log('[setup] 4 rolun hamısı daxil oldu');

    // 1) Əsas matris
    for (const [method, url, allowed, opt = {}] of MATRIX) {
      const list = allowed === 'ANY' ? ALL : allowed;
      for (const role of ROLES) {
        const shouldPass = list.includes(role);
        if (shouldPass && opt.destructive) continue; // icazəli + dağıdıcı → real məlumata toxunma
        const st = await call(method, url, { cookie: cookies[role], body: opt.body });
        verdict(`${role} ${method} ${url}`, st, shouldPass);
      }
      const anon = await call(method, url, { body: opt.body });
      verdict(`ANON ${method} ${url}`, anon, false);
    }

    // 2) Yol/metod/başlıq variantları: 200 qaytarmamalıdır (401/403/404 təhlükəsizdir)
    const guarded = ['/api/staff', '/api/mail-settings', '/api/audit-logs', '/api/insights/customers', '/api/admin/dashboard', '/api/promos'];
    const variants = (p) => [p + '/', p.toUpperCase(), p + '?x=1', p + '/.', p.replace('/api/', '/api//'), p + '%20', p.replace('/api/', '/api/./'), p + ';.css'];
    for (const p of guarded) {
      for (const v of variants(p)) {
        const anon = await call('GET', v);
        results.checked++;
        if (anon === 200) results.bad.push(`YOL-VARİANTI ANON 200: GET ${v}`);
        const low = await call('GET', v, { cookie: cookies.KITCHEN });
        results.checked++;
        if (low === 200) results.bad.push(`YOL-VARİANTI KITCHEN 200: GET ${v}`);
      }
      const head = await call('HEAD', p);
      results.checked++;
      if (head === 200) results.bad.push(`HEAD ANON 200: ${p}`);
      const ov = await call('POST', p, { headers: { 'X-HTTP-Method-Override': 'GET' }, body: {} });
      results.checked++;
      if (ov === 200) results.bad.push(`METOD-OVERRIDE ANON 200: ${p}`);
    }

    // 3) Token variantları
    const good = cookies.OWNER.split('=')[1];
    const tokVariants = {
      'yanlış-imza': good.slice(0, -3) + 'AAA',
      'kəsilmiş': good.split('.').slice(0, 2).join('.'),
      'boş': '',
      'Bearer-prefiks': 'Bearer ' + good,
      'refresh-access-yerinə': refreshes.OWNER || 'x',
    };
    for (const [name, tok] of Object.entries(tokVariants)) {
      const st = await call('GET', '/api/staff', { cookie: `qrmenu_token=${tok}` });
      verdict(`TOKEN(${name}) GET /api/staff`, st, false);
    }
    const bearer = await call('GET', '/api/staff', { headers: { Authorization: 'Bearer ' + good } });
    verdict('Authorization: Bearer (cookie yoxdur) GET /api/staff', bearer, false);
    const esc = await call('GET', '/api/staff?role=OWNER', { cookie: cookies.KITCHEN, headers: { 'X-Role': 'OWNER', 'X-User-Role': 'OWNER' } });
    verdict('KITCHEN + saxta rol başlığı GET /api/staff', esc, false);

    // 4) Rol dəyişəndə (real yol: OWNER → API) köhnə token dərhal aşağı səviyyəli olmalıdır; logout-all sonrası token ölməlidir
    const mgrId = (await pool.request().input('e', sql.NVarChar, emailOf('MANAGER')).query('SELECT id FROM admin_users WHERE email = @e')).recordset[0].id;
    const dem = await call('PUT', `/api/staff/${mgrId}`, { cookie: cookies.OWNER, body: { role: 'KITCHEN' } });
    if (dem !== 200) results.bad.push(`DEMOTE API alınmadı: ${dem}`);
    const demoted = await call('GET', '/api/audit-logs', { cookie: cookies.MANAGER });
    verdict('DEMOTE (API) sonrası köhnə MANAGER tokeni GET /api/audit-logs', demoted, false);

    const lo = await fetch(`${BASE}/api/auth/logout-all`, { method: 'POST', headers: { Cookie: cookies.WAITER, Origin: ORIGIN } });
    const afterLogout = await call('GET', '/api/tables', { cookie: cookies.WAITER });
    verdict(`LOGOUT-ALL(${lo.status}) sonrası köhnə token GET /api/tables`, afterLogout, false);
  } finally {
    const ok = await cleanup(pool);
    await pool.close();
    if (!ok) console.error('DİQQƏT: müvəqqəti hesablar tam silinmədi!');
  }

  console.log(`\nYoxlanılan kombinasiya: ${results.checked}`);
  if (results.bad.length) {
    console.log(`PROBLEM (${results.bad.length}):`);
    results.bad.forEach((b) => console.log(' - ' + b));
    process.exitCode = 1;
  } else {
    console.log('Bütün rol/yol/token kombinasiyaları gözlənilən kimi — problem YOXDUR.');
  }
}

(async () => {
  if (process.argv.includes('--cleanup')) {
    const pool = await connect();
    await cleanup(pool);
    await pool.close();
    return;
  }
  await run();
})().catch((e) => { console.error(e); process.exit(2); });
