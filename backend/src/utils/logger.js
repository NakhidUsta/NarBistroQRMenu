const fs = require('fs');
const path = require('path');

// Xəta jurnalı: hər gün üçün ayrı fayl (logs/error-YYYY-MM-DD.log), hər sətir bir JSON. Konsola da yazılır.
// Test mühitində fayl yazılmır. Stack trace yalnız burada saxlanılır — heç vaxt istifadəçiyə göndərilmir.
const LOG_DIR = process.env.LOG_DIR || path.join(__dirname, '..', '..', 'logs');
let dirReady = false;

function writeFile(entry) {
  if (process.env.NODE_ENV === 'test') return;
  try {
    if (!dirReady) {
      fs.mkdirSync(LOG_DIR, { recursive: true });
      dirReady = true;
    }
    const day = entry.time.slice(0, 10);
    fs.appendFile(path.join(LOG_DIR, `error-${day}.log`), `${JSON.stringify(entry)}\n`, () => {});
  } catch {
    // jurnal yazıla bilmirsə əsas sorğunu pozmuruq
  }
}

function error(message, err, context = {}) {
  const entry = {
    time: new Date().toISOString(),
    level: 'error',
    message,
    error: err ? { name: err.name, message: err.message, stack: err.stack } : undefined,
    ...context,
  };
  console.error(`[XƏTA] ${message}`, err || '');
  writeFile(entry);
}

function warn(message, context = {}) {
  const entry = { time: new Date().toISOString(), level: 'warn', message, ...context };
  console.warn(`[XƏBƏRDARLIQ] ${message}`);
  writeFile(entry);
}

module.exports = { error, warn, LOG_DIR };
