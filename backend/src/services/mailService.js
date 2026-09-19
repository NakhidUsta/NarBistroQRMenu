const nodemailer = require('nodemailer');
const AppError = require('../utils/AppError');
const logger = require('../utils/logger');

// E-poçt göndərmə (Gmail SMTP). Gmail üçün adi şifrə YOX, 16 simvollu "Tətbiq şifrəsi" (App Password) lazımdır:
// Google hesabı → Təhlükəsizlik → 2 addımlı doğrulama (aktiv olmalıdır) → Tətbiq şifrələri.
//   SMTP_USER=restoran@gmail.com   SMTP_PASS=abcd efgh ijkl mnop   (boşluqlar olsa da olar)
//   SMTP_HOST=smtp.gmail.com  SMTP_PORT=465 (defolt)   MAIL_FROM="Savora <restoran@gmail.com>" (istəyə bağlı)
// Konfiqurasiya yoxdursa xidmət sadəcə "söndürülüb" sayılır: şifrə sıfırlama düyməsi gizlənir, heç nə çökmür.
// Yalnız DEV üçün: MAIL_DRIVER=console — məktub göndərilmir, mətni konsola yazılır (tokenli link daxil!). Production-da işlətməyin.

let transporter = null;
let transporterKey = null;

const driver = () => (process.env.MAIL_DRIVER || '').toLowerCase();

function isConfigured() {
  return driver() === 'console' || !!(process.env.SMTP_USER && process.env.SMTP_PASS);
}

function getTransport() {
  const key = [process.env.SMTP_HOST, process.env.SMTP_PORT, process.env.SMTP_USER, process.env.SMTP_PASS].join('|');
  if (transporter && key === transporterKey) return transporter;
  const port = Number(process.env.SMTP_PORT) || 465;
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port,
    secure: port === 465, // 465 = birbaşa TLS; 587 = STARTTLS
    auth: { user: process.env.SMTP_USER, pass: String(process.env.SMTP_PASS).replace(/\s+/g, '') }, // Google şifrəni boşluqlarla göstərir
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });
  transporterKey = key;
  return transporter;
}

const fromAddress = (senderName) =>
  process.env.MAIL_FROM || `"${String(senderName || 'QR Menu').replace(/["\r\n]/g, '')}" <${process.env.SMTP_USER}>`;

// SMTP xətasını istifadəçiyə başa düşülən mesaja çevirir (texniki detal jurnala yazılır)
function friendlyError(err) {
  if (err?.code === 'EAUTH' || err?.responseCode === 535) {
    return new AppError(502, 'Gmail girişi qəbul olunmadı — SMTP_PASS Google "Tətbiq şifrəsi" olmalıdır (adi şifrə işləmir) və 2 addımlı doğrulama aktiv olmalıdır');
  }
  if (['ETIMEDOUT', 'ECONNECTION', 'ESOCKET', 'ECONNREFUSED', 'EDNS'].includes(err?.code)) {
    return new AppError(502, 'SMTP serverinə qoşulmaq mümkün olmadı — internet bağlantısını və SMTP_HOST/SMTP_PORT-u yoxlayın');
  }
  return new AppError(502, 'E-poçt göndərilə bilmədi');
}

// { to, subject, text, html, senderName } — uğurda göndərmə nəticəsini qaytarır, uğursuzluqda AppError atır
async function send({ to, subject, text, html, senderName }) {
  if (!isConfigured()) throw new AppError(503, 'E-poçt xidməti qurulmayıb (SMTP_USER / SMTP_PASS)');

  if (driver() === 'console') {
    console.log(`\n[MAIL:console] → ${to}\n  Mövzu: ${subject}\n${String(text).split('\n').map((l) => `  ${l}`).join('\n')}\n`);
    return { messageId: 'console' };
  }

  try {
    return await getTransport().sendMail({ from: fromAddress(senderName), to, subject, text, html });
  } catch (err) {
    logger.error('E-poçt göndərilə bilmədi', err, { to: String(to).replace(/(.).+(@.+)/, '$1***$2') });
    throw friendlyError(err);
  }
}

const resetTransport = () => {
  transporter = null;
  transporterKey = null;
};

module.exports = { send, isConfigured, resetTransport, friendlyError };
