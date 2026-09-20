const mailSettingsRepository = require('../repositories/mailSettingsRepository');
const mailService = require('./mailService');
const mailTemplates = require('./mailTemplates');
const restaurantService = require('./restaurantService');
const { encrypt, decrypt } = require('../utils/secretBox');
const AppError = require('../utils/AppError');
const logger = require('../utils/logger');

const EMAIL_RE = /^\S+@\S+\.\S+$/;

// Server açılanda bazadakı (paneldən daxil edilmiş) Gmail ayarını yaddaşa yükləyir. Açılmırsa (JWT_SECRET dəyişib və s.) .env-ə qayıdılır.
async function load() {
  try {
    const row = await mailSettingsRepository.get();
    if (!row) return mailService.setStoredConfig(null);
    mailService.setStoredConfig({ user: row.smtp_user, pass: decrypt(row.smtp_pass_enc) });
  } catch (err) {
    logger.warn(`Saxlanılmış e-poçt ayarı açıla bilmədi (${err.message}) — yenidən daxil edin`);
    mailService.setStoredConfig(null);
  }
}

// Şifrə HEÇ VAXT qaytarılmır — yalnız "qoşulub", ünvan və mənbə
async function getStatus() {
  const row = await mailSettingsRepository.get().catch(() => null);
  const source = mailService.configSource();
  return {
    configured: mailService.isConfigured(),
    source, // 'panel' | 'env' | 'console' | null
    smtp_user: source === 'panel' ? row?.smtp_user : source === 'env' ? process.env.SMTP_USER : null,
    updated_at: source === 'panel' ? row?.updated_at : null,
  };
}

// Gmail-ə GİRİŞİ əvvəlcə yoxlayır (yanlış App Password saxlanmır), sonra şifrələyib saxlayır və dərhal işə salır — yenidən başlatmaq lazım deyil
async function save({ smtp_user, smtp_pass }, adminId) {
  const user = String(smtp_user || '').trim();
  const pass = String(smtp_pass || '').replace(/\s+/g, ''); // Google şifrəni boşluqlarla göstərir
  if (!EMAIL_RE.test(user) || user.length > 150) throw new AppError(400, 'Düzgün Gmail ünvanı yazın');
  if (pass.length < 8 || pass.length > 100) throw new AppError(400, 'App Password (Tətbiq şifrəsi) yazın — Google 16 simvollu şifrə verir');
  await mailService.verifyCredentials({ user, pass }); // uğursuzdursa dostcasına xəta atır, heç nə saxlanmır
  await mailSettingsRepository.save({ smtp_user: user, smtp_pass_enc: encrypt(pass), updated_by: adminId });
  mailService.setStoredConfig({ user, pass });
  return getStatus();
}

async function remove() {
  await mailSettingsRepository.remove();
  mailService.setStoredConfig(null);
  return getStatus();
}

// Sınaq məktubu: qoşulan Gmail ünvanının ÖZÜNƏ gedir
async function sendTest() {
  const status = await getStatus();
  if (!status.configured) throw new AppError(503, 'E-poçt xidməti qurulmayıb');
  const to = status.smtp_user;
  if (!to) throw new AppError(400, 'Sınaq üçün Gmail ünvanı məlum deyil');
  let restaurant = 'QR Menu';
  try {
    restaurant = (await restaurantService.getRestaurant()).name || restaurant;
  } catch {
    // ad alınmadısa standart
  }
  await mailService.send({ to, senderName: restaurant, ...mailTemplates.testMail({ restaurant }) });
  return { to };
}

module.exports = { load, getStatus, save, remove, sendTest };
