// QA D: şifrə bərpası / e-poçt dinamik problar. MAIL_DRIVER=console ilə ayrıca nüsxə lazımdır (məktub mətni jurnala yazılır, token oradan oxunur):
//   cd backend && MAIL_DRIVER=console PORT=4001 EMAIL_FLOW_LIMIT=100000 node src/server.js > <log> 2>&1
//   cd backend && QA_BASE=http://localhost:4001 QA_MAILLOG=<log> node ../qa/mail-probes.js [--cleanup]
// Müvəqqəti məlumat: hesablar `qa.tmp.rbac.*@example.test` (tokenlər cascade silinir). Real SMTP-yə heç nə göndərilmir.
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const backend = path.resolve(__dirname, '..', 'backend');
require(path.join(backend, 'node_modules', 'dotenv')).config({ path: path.join(backend, '.env') });
const sql = require(path.join(backend, 'node_modules', 'mssql'));
const bcrypt = require(path.join(backend, 'node_modules', 'bcryptjs'));

const BASE = process.env.QA_BASE || 'http://localhost:4001';
const LOG = process.env.QA_MAILLOG;
const ORIGIN = 'http://localhost:5174';
const EMAIL = 'qa.tmp.rbac.owner@example.test';
const EMAIL2 = 'qa.tmp.rbac.newmail@example.test';
const PASS1 = `Qa-${crypto.randomBytes(9).toString('base64url')}-1x`;
const PASS2 = `Qa-${crypto.randomBytes(9).toString('base64url')}-2y`;

const findings = [];
const passed = [];
const check = (cond, ok, bad) => (cond ? passed.push(ok) : findings.push(bad));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function connect() {
  return new sql.ConnectionPool({
    server: process.env.DB_SERVER, database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD,
    options: { encrypt: false, trustServerCertificate: true },
  }).connect();
}

async function cleanup(pool) {
  const ids = (await pool.request().query("SELECT id FROM admin_users WHERE email LIKE 'qa.tmp.rbac.%@example.test'")).recordset.map((r) => r.id);
  if (ids.length) {
    const l = ids.join(',');
    await pool.request().query(`UPDATE order_status_history SET changed_by = NULL WHERE changed_by IN (${l})`);
    await pool.request().query(`DELETE FROM audit_logs WHERE admin_user_id IN (${l})`);
    await pool.request().query(`DELETE FROM admin_users WHERE id IN (${l})`);
  }
  const left = (await pool.request().query("SELECT COUNT(*) n FROM admin_users WHERE email LIKE 'qa.tmp.rbac.%@example.test'")).recordset[0].n;
  console.log(`[cleanup] hesab ${ids.length}; qalan=${left}`);
  return left === 0;
}

async function api(method, url, { cookie, body, headers = {}, raw } = {}) {
  const h = { Origin: ORIGIN, ...headers };
  if (cookie) h.Cookie = cookie;
  let payload = raw;
  if (body !== undefined) { h['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  const t0 = process.hrtime.bigint();
  const res = await fetch(BASE + url, { method, headers: h, body: payload });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* */ }
  return { status: res.status, json, text, ms: Number(process.hrtime.bigint() - t0) / 1e6, res };
}

const cookieOf = (res, name) => {
  const c = res.headers.getSetCookie().find((x) => x.startsWith(`${name}=`));
  return c ? c.split(';')[0] : null;
};

async function login(email, password) {
  const r = await api('POST', '/api/auth/login', { body: { email, password } });
  return { ...r, access: cookieOf(r.res, 'qrmenu_token'), all: r.res.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ') };
}

// Jurnaldən "→ <to>" məktublarını və linklərindəki tokeni oxuyur
function mails(to) {
  const text = fs.readFileSync(LOG, 'utf8');
  const blocks = text.split('[MAIL:console] → ').slice(1);
  return blocks.filter((b) => b.startsWith(to)).map((b) => {
    const m = /[?&]token=([A-Za-z0-9_%.-]+)/.exec(b);
    return { token: m ? decodeURIComponent(m[1]) : null, body: b, link: (/https?:\/\/\S+/.exec(b) || [])[0] };
  });
}
const lastToken = (to) => mails(to).at(-1)?.token;

async function main() {
  if (!LOG || !fs.existsSync(LOG)) throw new Error('QA_MAILLOG (console jurnal faylı) göstərilməyib');
  const pool = await connect();
  await cleanup(pool);
  await pool.request().input('e', sql.NVarChar, EMAIL).input('h', sql.NVarChar, await bcrypt.hash(PASS1, 10))
    .query("INSERT INTO admin_users (restaurant_id, email, password_hash, role) VALUES (1, @e, @h, 'OWNER')");
  try {
    const cfg = (await api('GET', '/api/auth/config')).json;
    check(cfg?.password_reset === true, 'D0 e-poçt xidməti (console) aktivdir', `D0 auth/config: ${JSON.stringify(cfg)}`);

    // ---- D1: hesab sızması (eyni cavab, oxşar vaxt) ----
    const variants = { exists: EMAIL, missing: 'qa.tmp.nobody@example.test', upper: EMAIL.toUpperCase() };
    const resp = {}; const timing = { exists: [], missing: [] };
    for (const [k, v] of Object.entries(variants)) resp[k] = await api('POST', '/api/auth/forgot-password', { body: { email: v } });
    check(resp.exists.status === 200 && resp.missing.status === 200 && resp.exists.text === resp.missing.text, 'D1 mövcud/mövcud olmayan e-poçt → eyni status və eyni mətn', `D1 cavablar fərqlidir: ${resp.exists.status}/${resp.missing.status}`);
    await sleep(500);
    for (let i = 0; i < 6; i++) {
      timing.missing.push((await api('POST', '/api/auth/forgot-password', { body: { email: `qa.tmp.nobody${i}@example.test` } })).ms);
      timing.exists.push((await api('POST', '/api/auth/forgot-password', { body: { email: EMAIL } })).ms);
    }
    const med = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
    check(Math.abs(med(timing.exists) - med(timing.missing)) < 40, `D1 vaxt fərqi kiçik (median ${med(timing.exists).toFixed(0)}ms vs ${med(timing.missing).toFixed(0)}ms)`, `D1 VAXT FƏRQİ hesabı aşkar edə bilər: ${med(timing.exists).toFixed(0)}ms vs ${med(timing.missing).toFixed(0)}ms`);
    for (const bad of ['', 'abc', 'x'.repeat(200) + '@a.co', null, 12, ['a@b.co'], { a: 1 }]) {
      const r = await api('POST', '/api/auth/forgot-password', { body: { email: bad } });
      check(r.status === 400, 'D1 yanlış format → 400', `D1 yanlış format ${JSON.stringify(bad).slice(0, 30)} → ${r.status}`);
    }

    // ---- D2: hər saat 3 məktub limiti (hesab üzrə) ----
    await sleep(800);
    const sent = mails(EMAIL).length;
    check(sent === 3, 'D2 hesab üçün saatda tam 3 sıfırlama məktubu göndərildi (7 sorğudan)', `D2 göndərilən məktub sayı: ${sent} (3 gözlənilirdi)`);

    // ---- D3: Host-header injection ----
    const links = mails(EMAIL).map((m) => m.link).filter(Boolean);
    check(links.length > 0 && links.every((l) => l.startsWith('http://localhost:5174/admin/reset-password?token=')), 'D3 link konfiqurasiyadan qurulur (Host/başlıqlara etibar edilmir)', `D3 linklər: ${links.slice(0, 2).join(' | ')}`);

    // Yalnız sonuncu token etibarlıdır (əvvəlkilər ləğv olunub)
    const all = mails(EMAIL).map((m) => m.token);
    const old = all[0]; const fresh = all.at(-1);
    check(old !== fresh, 'D3 hər sorğu yeni token verir', 'D3 token təkrarlandı');
    const oldTry = await api('POST', '/api/auth/reset-password', { body: { token: old, new_password: PASS2 } });
    check(oldTry.status === 400, 'D3 köhnə (əvəz olunmuş) token → 400', `D3 KÖHNƏ TOKEN İŞLƏDİ: ${oldTry.status}`);

    // ---- D4: token təxmini / yanlış tiplər ----
    for (const t of ['', 'x', 'A'.repeat(43), 'A'.repeat(500), null, 123, ['a'], { a: 1 }, "' OR 1=1--"]) {
      const r = await api('POST', '/api/auth/reset-password', { body: { token: t, new_password: PASS2 } });
      check(r.status === 400, 'D4 saxta token → 400', `D4 token ${JSON.stringify(t)?.slice(0, 25)} → ${r.status}`);
    }
    // purpose qarışdırma: e-poçt təsdiq tokeni ilə şifrə sıfırlama
    const lg0 = await login(EMAIL, PASS1);
    check(lg0.status === 200, 'D4 giriş (köhnə şifrə) işləyir', `D4 giriş alınmadı ${lg0.status}`);
    const sv = await api('POST', '/api/auth/send-verification', { cookie: lg0.access });
    await sleep(300);
    const verifyTok = lastToken(EMAIL);
    const sv2 = await api('POST', '/api/auth/reset-password', { body: { token: verifyTok, new_password: PASS2 } });
    check(sv.status === 200 && sv2.status === 400, 'D4 təsdiq tokeni şifrə sıfırlamada qəbul edilmir (purpose)', `D4 PURPOSE QARIŞDI: send-verification ${sv.status}, reset ${sv2.status}`);
    // yuxarıdakı 'verify' göndərişi reset tokenini ləğv etməməlidir
    const stillOk = await api('POST', '/api/auth/reset-password', { body: { token: fresh, new_password: '123' } });
    check(stillOk.status === 400 && /8 simvol/.test(stillOk.text), 'D4 zəif şifrə (3 simvol) → 400', `D4 zəif şifrə cavabı: ${stillOk.status} ${stillOk.text.slice(0, 80)}`);

    // ---- D5: sıfırlama (bloklanmış hesab + aktiv sessiya) ----
    for (let i = 0; i < 5; i++) await login(EMAIL, 'yanlis-sifre-' + i);
    const locked = await login(EMAIL, PASS1);
    check(locked.status !== 200, `D5 5 yanlış cəhddən sonra hesab bloklanıb (${locked.status})`, 'D5 hesab bloklanmadı (brute-force qoruması yoxdur?)');
    const sessionCookie = lg0.all; // sıfırlamadan əvvəl açılmış sessiya
    // eyni tokenlə 8 paralel istifadə
    const par = await Promise.all(Array.from({ length: 8 }, () => api('POST', '/api/auth/reset-password', { body: { token: fresh, new_password: PASS2 } })));
    check(par.filter((r) => r.status === 200).length === 1, 'D5 eyni tokenlə 8 paralel sıfırlamadan yalnız 1-i keçdi', `D5 paralel nəticələr: ${par.map((r) => r.status).join(',')}`);
    const reuse = await api('POST', '/api/auth/reset-password', { body: { token: fresh, new_password: PASS1 } });
    check(reuse.status === 400, 'D5 istifadə olunmuş token təkrar → 400', `D5 TOKEN TƏKRAR İŞLƏDİ ${reuse.status}`);
    const oldLogin = await login(EMAIL, PASS1);
    check(oldLogin.status !== 200, 'D5 köhnə şifrə artıq işləmir', 'D5 KÖHNƏ ŞİFRƏ HƏLƏ İŞLƏYİR');
    const newLogin = await login(EMAIL, PASS2);
    check(newLogin.status === 200, 'D5 yeni şifrə ilə giriş işləyir (bloklanma sıfırlamadan sonra da davam etmir)', `D5 YENİ ŞİFRƏ İLƏ GİRİŞ ALINMADI: ${newLogin.status} ${newLogin.text.slice(0, 100)} — sıfırlama bloklanmanı silmir`);
    const oldSess = await api('GET', '/api/auth/me', { cookie: sessionCookie });
    check(oldSess.status === 401, 'D5 sıfırlamadan əvvəlki sessiya ləğv olundu', `D5 KÖHNƏ SESSİYA İŞLƏYİR (${oldSess.status})`);
    const refreshOld = await fetch(`${BASE}/api/auth/refresh`, { method: 'POST', headers: { Origin: ORIGIN, Cookie: sessionCookie } });
    check(refreshOld.status === 401, 'D5 köhnə refresh token ilə yeniləmə mümkün deyil', `D5 KÖHNƏ REFRESH İŞLƏDİ (${refreshOld.status})`);

    // ---- D6: vaxtı keçmiş token ----
    if (newLogin.status === 200) {
      await api('POST', '/api/auth/forgot-password', { body: { email: EMAIL } });
      await sleep(600);
      const tok = lastToken(EMAIL);
      await pool.request().query("UPDATE email_tokens SET expires_at = DATEADD(MINUTE, -1, SYSUTCDATETIME()) WHERE used_at IS NULL AND admin_user_id = (SELECT id FROM admin_users WHERE email = '" + EMAIL + "')");
      const exp = await api('POST', '/api/auth/reset-password', { body: { token: tok, new_password: PASS1 } });
      check(exp.status === 400, 'D6 vaxtı keçmiş token → 400', `D6 VAXTI KEÇMİŞ TOKEN İŞLƏDİ ${exp.status}`);
    }

    // ---- D7: e-poçt dəyişikliyi ----
    const cur = await login(EMAIL, PASS2);
    await pool.request().query("UPDATE email_tokens SET expires_at = DATEADD(HOUR, 1, SYSUTCDATETIME()) WHERE used_at IS NULL");
    const ce1 = await api('POST', '/api/auth/change-email', { cookie: cur.access, body: { new_email: EMAIL2, current_password: 'yanlis' } });
    check(ce1.status === 400, 'D7 yanlış cari şifrə ilə e-poçt dəyişmir', `D7 YANLIŞ ŞİFRƏ İLƏ DƏYİŞDİ ${ce1.status}`);
    for (const bad of ['abc', '', 'a@b', 'x'.repeat(200) + '@a.co', `${EMAIL}\r\nBcc: evil@x.co`, null, ['a@b.co']]) {
      const r = await api('POST', '/api/auth/change-email', { cookie: cur.access, body: { new_email: bad, current_password: PASS2 } });
      check(r.status === 400, 'D7 yanlış e-poçt formatı → 400', `D7 format ${JSON.stringify(bad)?.slice(0, 30)} → ${r.status}`);
    }
    const dup = await api('POST', '/api/auth/change-email', { cookie: cur.access, body: { new_email: 'admin@qrmenu.local', current_password: PASS2 } });
    check(dup.status === 409, 'D7 başqa hesabın e-poçtuna dəyişmək → 409', `D7 DUBLİKAT E-POÇT ${dup.status}`);
    // sıfırlama tokeni açıq ikən e-poçt dəyişir → köhnə token ölməlidir
    await api('POST', '/api/auth/forgot-password', { body: { email: EMAIL } });
    await sleep(600);
    const beforeChange = lastToken(EMAIL);
    const ce = await api('POST', '/api/auth/change-email', { cookie: cur.access, body: { new_email: EMAIL2, current_password: PASS2 } });
    check(ce.status === 200, 'D7 e-poçt dəyişdi', `D7 e-poçt dəyişmədi: ${ce.status} ${ce.text.slice(0, 100)}`);
    const dead = await api('POST', '/api/auth/reset-password', { body: { token: beforeChange, new_password: PASS1 } });
    check(dead.status === 400, 'D7 e-poçt dəyişdikdən sonra köhnə sıfırlama linki ölüdür', `D7 KÖHNƏ LİNK İŞLƏDİ ${dead.status}`);
    const newLogin2 = await login(EMAIL2, PASS2);
    const oldEmailLogin = await login(EMAIL, PASS2);
    check(newLogin2.status === 200 && oldEmailLogin.status !== 200, 'D7 yeni e-poçtla giriş işləyir, köhnə ilə yox', `D7 giriş: yeni ${newLogin2.status}, köhnə ${oldEmailLogin.status}`);
    // yeni ünvana sıfırlama məktubu getməlidir; köhnəyə yox
    const nBefore = mails(EMAIL).length;
    await api('POST', '/api/auth/forgot-password', { body: { email: EMAIL2 } });
    await api('POST', '/api/auth/forgot-password', { body: { email: EMAIL } });
    await sleep(600);
    check(mails(EMAIL2).length >= 1 && mails(EMAIL).length === nBefore, 'D7 sıfırlama məktubu yalnız yeni ünvana gedir', 'D7 məktub köhnə ünvana da/gəlmədi');

    // ---- D8: e-poçt təsdiqi ----
    const v = await api('POST', '/api/auth/verify-email', { body: { token: lastToken(EMAIL2) } });
    check([200, 400].includes(v.status), `D8 verify-email cavabı (${v.status})`, `D8 verify-email ${v.status}`);
    const vBad = await api('POST', '/api/auth/verify-email', { body: { token: 'saxta' } });
    check(vBad.status === 400, 'D8 saxta təsdiq tokeni → 400', `D8 saxta təsdiq tokeni ${vBad.status}`);

    // ---- D9: nəhəng şifrə (CPU) ----
    const huge = await api('POST', '/api/auth/change-password', { cookie: newLogin2.access, body: { current_password: PASS2, new_password: 'A'.repeat(90 * 1024) } });
    check(huge.status === 400 || huge.status === 413, `D9 90KB şifrə rədd edildi (${huge.status}, ${huge.ms.toFixed(0)}ms)`, `D9 90KB ŞİFRƏ QƏBUL EDİLDİ: ${huge.status} ${huge.ms.toFixed(0)}ms`);
    const long73 = await api('POST', '/api/auth/change-password', { cookie: newLogin2.access, body: { current_password: PASS2, new_password: 'B'.repeat(200) } });
    check(long73.status === 400, 'D9 128 simvoldan uzun şifrə rədd edilir (bcrypt 72 baytdan sonrasını sayır)', `D9 200 SİMVOLLUQ ŞİFRƏ QƏBUL EDİLDİ (${long73.status}) — bcrypt yalnız ilk 72 baytı nəzərə alır`);

    // ---- D10: mail-settings (OWNER) cavabı sirr daşımır ----
    const own = await login(EMAIL2, PASS2);
    const ms = await api('GET', '/api/mail-settings', { cookie: own.access });
    check(ms.status === 200 && !/pass|secret|enc/i.test(Object.keys(ms.json || {}).join(',')), `D10 GET /api/mail-settings sirr sahəsi qaytarmır (${Object.keys(ms.json || {}).join(',')})`, `D10 mail-settings sahələri: ${Object.keys(ms.json || {}).join(',')}`);
    const msBad = await api('PUT', '/api/mail-settings', { cookie: own.access, body: { smtp_user: 'notanemail', smtp_pass: 'x' } });
    check(msBad.status === 400, 'D10 yanlış Gmail ünvanı → 400 (SMTP-yə cəhd yoxdur)', `D10 yanlış Gmail ${msBad.status} ${msBad.text.slice(0, 80)}`);
    const msSsrf = await api('PUT', '/api/mail-settings', { cookie: own.access, body: { smtp_user: 'a@b.co', smtp_pass: 'x', smtp_host: '127.0.0.1', host: '127.0.0.1' } });
    check(msSsrf.status !== 200, `D10 smtp_host/host paneldən dəyişdirilə bilmir (SSRF) (${msSsrf.status})`, 'D10 host sahəsi qəbul edildi');
  } finally {
    const clean = await cleanup(pool);
    await pool.close();
    if (!clean) console.error('DİQQƏT: hesablar tam silinmədi!');
  }

  console.log(`\n=== KEÇDİ (${passed.length}) ===`);
  [...new Set(passed)].forEach((m) => console.log(' + ' + m));
  console.log(`\n=== TAPINTILAR (${findings.length}) ===`);
  findings.forEach((m) => console.log(' - ' + m));
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
