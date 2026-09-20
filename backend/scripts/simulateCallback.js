// Epoint callback-ini (webhook) YEREL olaraq simulyasiya edir — real Epoint imza sxemi və sizin EPOINT_PRIVATE_KEY ilə.
//   npm run payment:simulate -- <sifariş_ID> [success|failed|refunded]
// Məqsəd: açarlar gələndən sonra "ödəniş təsdiqlənəndə sifariş mətbəxə düşür" axınını real Epoint olmadan yoxlamaq.
// Sifarişin ƏN SON ödəniş cəhdi üçün imzalı callback göndərir. Production-da bloklanır (real sifarişləri "ödənilib" edə bilər).
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const epoint = require('../src/services/payments/epoint');
const { poolPromise, sql } = require('../src/config/db');

async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('Production-da simulyasiya bloklanıb (real sifarişləri saxta "ödənilib" edə bilər).');
  const [orderIdArg, outcome = 'success'] = process.argv.slice(2);
  const orderId = Number(orderIdArg);
  if (!Number.isInteger(orderId) || orderId <= 0) throw new Error('İstifadə: npm run payment:simulate -- <sifariş_ID> [success|failed|refunded]');
  if (!['success', 'failed', 'refunded'].includes(outcome)) throw new Error('Nəticə success, failed və ya refunded olmalıdır');
  if (!epoint.isConfigured()) throw new Error('EPOINT_PUBLIC_KEY / EPOINT_PRIVATE_KEY təyin edilməyib (backend/.env)');

  const pool = await poolPromise;
  const payment = (await pool.request().input('id', sql.Int, orderId).query('SELECT TOP 1 * FROM payments WHERE order_id = @id AND provider_order_id IS NOT NULL ORDER BY id DESC')).recordset[0];
  if (!payment) throw new Error(`Sifariş #${orderId} üçün ödəniş cəhdi yoxdur. Əvvəl saytda "Onlayn kart" ilə sifariş verib "Ödənişə keç" basın (Epoint-ə sorğu uğursuz olsa da cəhd qeydi yaranır).`);

  const payload = {
    order_id: payment.provider_order_id,
    status: outcome === 'success' ? 'success' : outcome === 'refunded' ? 'returned' : 'failed',
    code: outcome === 'success' ? '000' : '100',
    message: outcome === 'success' ? 'Success' : 'Simulyasiya',
    transaction: payment.provider_transaction || `sim-${Date.now()}`,
    bank_transaction: 'SIM',
    operation_code: '100',
    card_mask: '415432******1234',
    amount: Number(payment.amount),
  };
  const data = Buffer.from(JSON.stringify(payload)).toString('base64');
  const signature = epoint.sign(data, process.env.EPOINT_PRIVATE_KEY);
  const url = `http://localhost:${process.env.PORT || 4000}/api/payments/epoint/callback`;

  console.log(`Callback göndərilir → ${url}\n  sifariş #${orderId}, ödəniş #${payment.id} (${payload.status}, ${payload.amount} AZN)`);
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ data, signature }) });
  console.log(`  cavab: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);

  const order = (await pool.request().input('id', sql.Int, orderId).query('SELECT status, payment_status, paid_amount FROM orders WHERE id = @id')).recordset[0];
  console.log(`  sifariş indi: status=${order.status}, payment_status=${order.payment_status}, paid_amount=${order.paid_amount ?? '—'}`);
  process.exit(res.ok ? 0 : 1);
}

main().catch((err) => {
  console.error(`✗ ${err.message}`);
  process.exit(1);
});
