const http = require('http');
const app = require('./app');
const { initSockets } = require('./sockets');
const systemAlertService = require('./services/systemAlertService');
const logger = require('./utils/logger');

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
});
