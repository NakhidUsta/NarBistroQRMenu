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

  // Müştərinin göndərdiyi dəyər DB parametrinə sığmır (INT aşımı, çox uzun mətn) — server xətası deyil, 400.
  // (mssql: EPARAM = parametr doğrulaması; 2628/8152 = "string or binary data would be truncated";
  //  NVarChar(N) parametrə N-dən uzun mətn verəndə SQL Server "TDS ... Data type 0xE7 has an invalid data length" qaytarır)
  const tooLongForParam = err.code === 'EREQUEST' && /Data type 0x[0-9A-F]+ has an invalid data length/i.test(err.message || '');
  if (err.code === 'EPARAM' || tooLongForParam || (err.code === 'EREQUEST' && [2628, 8152].includes(err.number))) {
    return res.status(400).json({ error: 'Göndərilən dəyər yolverilən həddi aşır və ya düzgün deyil' });
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
