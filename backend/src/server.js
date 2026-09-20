require('dotenv').config(); // sirlər yoxlanılmazdan əvvəl .env yüklənməlidir
const http = require('http');
const { assertSecrets } = require('./config/secretsCheck');

// Zəif JWT_SECRET ilə production-da server başlamır (inkişafda yalnız xəbərdarlıq)
try {
  for (const warning of assertSecrets()) console.warn(`[XƏBƏRDARLIQ] ${warning}`);
} catch (err) {
  console.error(err.message);
  process.exit(1);
}

const app = require('./app');
const { initSockets } = require('./sockets');
const systemAlertService = require('./services/systemAlertService');
const logger = require('./utils/logger');
const paymentService = require('./services/paymentService');
const authService = require('./services/authService');
const mailSettingsService = require('./services/mailSettingsService');

const server = http.createServer(app);
initSockets(server);

// Tutulmayan xətalar prosesi səssiz çökdürməsin: jurnala yaz, sahib/menecerə xəbər ver
process.on('unhandledRejection', (reason) => {
  logger.error('unhandledRejection', reason instanceof Error ? reason : new Error(String(reason)));
  systemAlertService.report('unhandledRejection', 'Sistem xətası', `Tutulmayan xəta: ${reason?.message || reason}`);
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`QR Menu backend http://localhost:${PORT} ünvanında işləyir`);
  systemAlertService.startMonitor();
  authService.warnIfDefaultAdminPassword().catch(() => {}); // defolt admin şifrəsi xəbərdarlığı
  mailSettingsService.load(); // paneldən daxil edilmiş Gmail girişini yaddaşa yüklə
  paymentService.startExpirySweeper(); // ödənilməyən onlayn sifarişləri vaxtında ləğv edir, stoku qaytarır
});
