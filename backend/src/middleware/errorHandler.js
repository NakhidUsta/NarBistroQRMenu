const AppError = require('../utils/AppError');

function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: err.message });
  }
  console.error(err);
  res.status(500).json({ error: 'Server xətası baş verdi' });
}

module.exports = errorHandler;
