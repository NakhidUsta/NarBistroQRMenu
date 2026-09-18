// DB-də vaxtlar UTC saxlanılır; gün sərhədləri restoranın yerli vaxtına görə hesablanır.
const TZ = Number.parseInt(process.env.TZ_OFFSET_HOURS ?? '4', 10) || 0;

module.exports = { TZ };
