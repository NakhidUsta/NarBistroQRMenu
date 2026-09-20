// Onlayn ödəniş hazırlıq yoxlaması:  cd backend && npm run payment:check
// Epoint açarlarını .env-ə qoyandan sonra işlədin: konfiqurasiyanı, bazanı, Epoint əlçatanlığını yoxlayır və
// Epoint-ə merchant qeydiyyatında verəcəyiniz 4 ünvanı çap edir.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const paymentsConfig = require('../src/config/payments');
const epoint = require('../src/services/payments/epoint');
const { poolPromise } = require('../src/config/db');

const results = [];
const ok = (msg) => results.push(['✓', msg]);
const warn = (msg) => results.push(['!', msg]);
const fail = (msg) => results.push(['✗', msg]);
const isLocal = (url) => /localhost|127\.0\.0\.1/.test(url);

async function main() {
  const cfg = paymentsConfig.get();

  // 1) provayder və açarlar
  if (!cfg.provider) fail('PAYMENT_PROVIDER təyin edilməyib (onlayn ödəniş söndürülüb). Epoint üçün: PAYMENT_PROVIDER=epoint');
  else if (cfg.provider === 'test') warn('PAYMENT_PROVIDER=test — saxta ödəniş rejimi (real pul yoxdur). Real üçün PAYMENT_PROVIDER=epoint yazın.');
  else if (cfg.provider !== 'epoint') fail(`Naməlum provayder: "${cfg.provider}" (epoint və ya test olmalıdır)`);
  else {
    ok('PAYMENT_PROVIDER=epoint');
    if (!cfg.epoint.publicKey) fail('EPOINT_PUBLIC_KEY boşdur');
    else if (!/^i\d{6,}$/.test(cfg.epoint.publicKey)) warn(`EPOINT_PUBLIC_KEY "${cfg.epoint.publicKey}" adətən "i000000001" formatındadır — düzgünlüyünü yoxlayın`);
    else ok(`EPOINT_PUBLIC_KEY (${cfg.epoint.publicKey})`);
    if (!cfg.epoint.privateKey) fail('EPOINT_PRIVATE_KEY boşdur');
    else if (cfg.epoint.privateKey.length < 16) warn('EPOINT_PRIVATE_KEY qısa görünür — tam kopyalandığından əmin olun');
    else ok('EPOINT_PRIVATE_KEY təyin edilib (gizli saxlanılır)');
  }

  // 2) ünvanlar
  if (!process.env.PUBLIC_URL) warn('PUBLIC_URL təyin edilməyib — hazırda ' + cfg.publicUrl + ' istifadə olunur');
  if (isLocal(cfg.publicUrl)) warn(`Sayt ünvanı localhost-dur (${cfg.publicUrl}) — real domen olmadan Epoint callback göndərə bilməz; müştəri qayıdanda status "yoxla" mexanizmi ilə çəkilir`);
  else if (!cfg.publicUrl.startsWith('https://')) fail(`PUBLIC_URL https olmalıdır (${cfg.publicUrl})`);
  else ok(`PUBLIC_URL ${cfg.publicUrl}`);

  // 3) baza
  try {
    const pool = await poolPromise;
    const r = await pool.request().query(`
      SELECT (SELECT COUNT(*) FROM sys.tables WHERE name = 'payments') AS has_payments,
             (SELECT COUNT(*) FROM sys.columns WHERE object_id = OBJECT_ID('orders') AND name = 'payment_status') AS has_order_cols,
             (SELECT COUNT(*) FROM sys.columns WHERE object_id = OBJECT_ID('restaurants') AND name = 'pay_online') AS has_pay_cols
    `);
    const row = r.recordset[0];
    if (row.has_payments && row.has_order_cols && row.has_pay_cols) ok('Baza sxemi hazırdır (migration 017)');
    else fail('Baza sxemi köhnədir — işlədin: sqlcmd -S localhost -E -C -I -f 65001 -d qr_menu -i backend/database/migrations/017_payments.sql');
    const rest = (await pool.request().query('SELECT pay_cash, pay_card_pos, pay_online, currency FROM restaurants WHERE id = 1')).recordset[0];
    if (rest) {
      if (String(rest.currency).toUpperCase() !== 'AZN') fail(`Restoran valyutası ${rest.currency} — Epoint yalnız AZN qəbul edir (Ayarlar → Valyuta kodu)`);
      else ok('Valyuta AZN');
      if (rest.pay_online) ok('Ayarlarda "Onlayn kart ödənişi" AÇIQDIR');
      else warn('Ayarlarda "Onlayn kart ödənişi" hələ söndürülüb — hazır olanda Admin → Ayarlar → Ödəniş üsulları-ndan açın');
    }
  } catch (err) {
    fail(`Bazaya qoşulmaq olmadı: ${err.message}`);
  }

  // 4) Epoint əlçatanlığı (heartbeat — imza tələb etmir)
  try {
    if (await epoint.heartbeat()) ok('Epoint əlçatandır (heartbeat: ok)');
    else fail('Epoint heartbeat "ok" qaytarmadı');
  } catch (err) {
    fail(`Epoint-ə çatmaq olmadı: ${err.message}`);
  }

  // 5) imza öz-sınağı (callback imzalama/yoxlama dövrü)
  if (cfg.epoint.privateKey && cfg.epoint.publicKey) {
    const data = Buffer.from(JSON.stringify({ order_id: 'selftest', status: 'success', amount: 1 })).toString('base64');
    const parsed = epoint.parseCallback({ data, signature: epoint.sign(data, cfg.epoint.privateKey) });
    const forged = epoint.parseCallback({ data, signature: epoint.sign(data, `${cfg.epoint.privateKey}x`) });
    if (parsed.valid && !forged.valid) ok('Callback imza yoxlaması işləyir (düzgün imza qəbul, saxta rədd)');
    else fail('Callback imza öz-sınağı uğursuz oldu');
  }

  // Nəticə
  console.log('\nÖdəniş hazırlıq yoxlaması\n');
  for (const [mark, msg] of results) console.log(` ${mark} ${msg}`);

  const success = `${cfg.publicUrl}/payment/success`;
  const error = `${cfg.publicUrl}/payment/error`;
  const result = `${cfg.apiPublicUrl}/api/payments/epoint/callback`;
  console.log(`
Epoint merchant qeydiyyatında (və ya kabinetdə "Ödəniş qəbulu → sayt") bu 4 ünvanı verin:
   Sayt ünvanı : ${cfg.publicUrl}
   success_url : ${success}
   error_url   : ${error}
   result_url  : ${result}
Epoint bunları yoxladıqdan sonra public_key və private_key verir → backend/.env → serveri yenidən başladın → bu yoxlamanı təkrar işlədin.
`);
  const failed = results.filter(([m]) => m === '✗').length;
  const warned = results.filter(([m]) => m === '!').length;
  console.log(failed ? `✗ ${failed} problem var — yuxarıdakıları düzəldin.` : warned ? `✓ Kritik problem yoxdur (${warned} xəbərdarlıq).` : '✓ Hər şey hazırdır. Kiçik məbləğlə bir real sınaq ödənişi edin.');
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error('Yoxlama xətası:', err.message);
  process.exit(1);
});
