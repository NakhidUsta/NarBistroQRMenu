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
// Admin paneldən daxil edilmiş Gmail girişi (bazada şifrələnmiş; server açılanda mailSettingsService.load() yükləyir). .env-dən üstündür.
let storedConfig = null;

const driver = () => (process.env.MAIL_DRIVER || '').toLowerCase();

// Hazırda istifadə olunan giriş: əvvəl panel, sonra .env
function credentials() {
  if (storedConfig?.user && storedConfig?.pass) return storedConfig;
  if (process.env.SMTP_USER && process.env.SMTP_PASS) return { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS };
  return null;
}

function isConfigured() {
  return driver() === 'console' || !!credentials();
}

// 'console' | 'panel' | 'env' | null
function configSource() {
  if (driver() === 'console') return 'console';
  if (storedConfig?.user && storedConfig?.pass) return 'panel';
  return credentials() ? 'env' : null;
}

function buildTransport({ user, pass }) {
  const port = Number(process.env.SMTP_PORT) || 465;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port,
    secure: port === 465, // 465 = birbaşa TLS; 587 = STARTTLS
    auth: { user, pass: String(pass).replace(/\s+/g, '') }, // Google şifrəni boşluqlarla göstərir
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });
}

function getTransport() {
  const creds = credentials();
  const key = [process.env.SMTP_HOST, process.env.SMTP_PORT, creds?.user, creds?.pass].join('|');
  if (transporter && key === transporterKey) return transporter;
  transporter = buildTransport(creds);
  transporterKey = key;
  return transporter;
}

const fromAddress = (senderName) =>
  process.env.MAIL_FROM || `"${String(senderName || 'QR Menu').replace(/["\r\n]/g, '')}" <${credentials()?.user}>`;

// Giriş məlumatlarını SAXLAMADAN yoxlayır (Gmail-ə həqiqətən daxil olmağa cəhd). Uğursuzdursa dostcasına xəta atır.
async function verifyCredentials(creds) {
  const probe = buildTransport(creds);
  try {
    await probe.verify();
  } catch (err) {
    logger.warn(`SMTP girişi yoxlanılmadı: ${err.code || err.message}`);
    throw friendlyError(err);
  } finally {
    probe.close();
  }
}

function setStoredConfig(config) {
  storedConfig = config;
  resetTransport();
}

// SMTP xətasını istifadəçiyə başa düşülən mesaja çevirir (texniki detal jurnala yazılır)
function friendlyError(err) {
  if (err?.code === 'EAUTH' || err?.responseCode === 535) {
    return new AppError(502, 'Gmail girişi qəbul olunmadı — Gmail ünvanı düz olmalı və şifrə Google-un "Tətbiq şifrəsi" (App Password) olmalıdır (adi Gmail şifrəsi işləmir; 2 addımlı doğrulama açıq olmalıdır)');
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

module.exports = { send, isConfigured, configSource, verifyCredentials, setStoredConfig, resetTransport, friendlyError };
