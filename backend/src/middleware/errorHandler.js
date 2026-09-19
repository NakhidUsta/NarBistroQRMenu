const AppError = require('../utils/AppError');
const logger = require('../utils/logger');

function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: err.message, ...(err.details || {}) });
  }
  // body-parser / multer kimi kitabxanaların müştəri xətaları (məs. yanlış JSON) — 4xx, server xətası deyil
  const status = err.status || err.statusCode;
  if (Number.isInteger(status) && status >= 400 && status < 500) {
    return res.status(status).json({ error: status === 413 ? 'Sorğu çox böyükdür' : 'Yanlış sorğu' });
  }

  logger.error('Gözlənilməyən server xətası', err, { method: req.method, url: String(req.originalUrl || '').split('?')[0] });
  // Sahib/menecerə canlı xəbərdarlıq (sorğu-cavab dövrəsini gecikdirmir, xətası yutulur)
  try {
    require('../services/systemAlertService').reportRequestError(req, err)?.catch?.(() => {});
  } catch {
    // xəbərdarlıq mexanizmi səhv versə də istifadəçiyə yenə də təhlükəsiz cavab qaytarılır
  }
  res.status(500).json({ error: 'Server xətası baş verdi' });
}

module.exports = errorHandler;
