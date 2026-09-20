const { sql } = require('../config/db');

// `db` — pool və ya sql.Transaction (hər ikisi sql.Request ilə işləyir)
const req = (db) => new sql.Request(db);

async function create(db, { order_id, provider, method, status = 'PENDING', amount, currency = 'AZN', provider_order_id, provider_transaction, created_by, paid_at }) {
  const result = await req(db)
    .input('order_id', sql.Int, order_id)
    .input('provider', sql.NVarChar(20), provider)
    .input('method', sql.NVarChar(12), method)
    .input('status', sql.NVarChar(12), status)
    .input('amount', sql.Decimal(10, 2), amount)
    .input('currency', sql.NVarChar(3), currency)
    .input('provider_order_id', sql.NVarChar(64), provider_order_id || null)
    .input('provider_transaction', sql.NVarChar(100), provider_transaction || null)
    .input('created_by', sql.Int, created_by || null)
    .input('paid_at', sql.DateTime2, paid_at || null)
    .query(`
      INSERT INTO payments (order_id, provider, method, status, amount, currency, provider_order_id, provider_transaction, created_by, paid_at)
      OUTPUT INSERTED.*
      VALUES (@order_id, @provider, @method, @status, @amount, @currency, @provider_order_id, @provider_transaction, @created_by, @paid_at)
    `);
  return result.recordset[0];
}

// Yenilənmə üçün kilidlə oxuyur (callback və "yoxla" sorğusu eyni anda gəlsə ikiqat emal olunmasın)
async function findByProviderOrderIdForUpdate(tx, providerOrderId) {
  const result = await req(tx)
    .input('poid', sql.NVarChar(64), providerOrderId)
    .query('SELECT * FROM payments WITH (UPDLOCK, ROWLOCK) WHERE provider_order_id = @poid');
  return result.recordset[0] || null;
}

async function findByProviderOrderId(db, providerOrderId) {
  const result = await req(db).input('poid', sql.NVarChar(64), providerOrderId).query('SELECT * FROM payments WHERE provider_order_id = @poid');
  return result.recordset[0] || null;
}

async function update(db, id, { status, provider_transaction, card_mask, failure_reason, paid_at }) {
  const result = await req(db)
    .input('id', sql.Int, id)
    .input('status', sql.NVarChar(12), status || null)
    .input('tx', sql.NVarChar(100), provider_transaction || null)
    .input('card', sql.NVarChar(30), card_mask || null)
    .input('reason', sql.NVarChar(300), failure_reason ? String(failure_reason).slice(0, 300) : null)
    .input('paid_at', sql.DateTime2, paid_at || null)
    .query(`
      UPDATE payments
      SET status = COALESCE(@status, status),
          provider_transaction = COALESCE(@tx, provider_transaction),
          card_mask = COALESCE(@card, card_mask),
          failure_reason = COALESCE(@reason, failure_reason),
          paid_at = COALESCE(@paid_at, paid_at),
          updated_at = SYSUTCDATETIME()
      OUTPUT INSERTED.*
      WHERE id = @id
    `);
  return result.recordset[0] || null;
}

async function listByOrder(db, orderId) {
  const result = await req(db).input('id', sql.Int, orderId).query(`
    SELECT p.id, p.provider, p.method, p.status, p.amount, p.currency, p.card_mask, p.failure_reason, p.created_at, p.paid_at, a.email AS created_by_email
    FROM payments p LEFT JOIN admin_users a ON a.id = p.created_by
    WHERE p.order_id = @id ORDER BY p.created_at DESC, p.id DESC
  `);
  return result.recordset;
}

// Hələ tamamlanmamış, provayder tranzaksiyası olan cəhdlər (statusu provayderdən soruşmaq üçün)
async function findPendingWithTransaction(db, orderId) {
  const result = await req(db).input('id', sql.Int, orderId).query(`
    SELECT * FROM payments WHERE order_id = @id AND provider_transaction IS NOT NULL AND status IN (N'PENDING', N'FAILED') ORDER BY id DESC
  `);
  return result.recordset;
}

// Sifarişin uğurlu (ödənilmiş) cəhdi — geri qaytarma bu tranzaksiyaya edilir
async function findSuccessfulByOrder(db, orderId) {
  const result = await req(db).input('id', sql.Int, orderId).query(`SELECT TOP 1 * FROM payments WHERE order_id = @id AND status = N'SUCCESS' ORDER BY paid_at DESC, id DESC`);
  return result.recordset[0] || null;
}

// Sifariş ləğv olunanda açıq cəhdlər bağlanır
async function failOpenForOrder(db, orderId, reason) {
  await req(db)
    .input('id', sql.Int, orderId)
    .input('reason', sql.NVarChar(300), reason)
    .query(`UPDATE payments SET status = N'FAILED', failure_reason = @reason, updated_at = SYSUTCDATETIME() WHERE order_id = @id AND status = N'PENDING'`);
}

module.exports = { create, findByProviderOrderIdForUpdate, findByProviderOrderId, update, listByOrder, findPendingWithTransaction, findSuccessfulByOrder, failOpenForOrder };
