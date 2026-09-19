class AppError extends Error {
  // details — müştəriyə də qaytarılan əlavə maşın-oxunaqlı sahələr (məs. { code: 'PRICE_CHANGED', total })
  constructor(status, message, details) {
    super(message);
    this.status = status;
    if (details) this.details = details;
  }
}

module.exports = AppError;
