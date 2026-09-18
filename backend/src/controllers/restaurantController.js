const restaurantService = require('../services/restaurantService');
const auditService = require('../services/auditService');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');

exports.getRestaurant = asyncHandler(async (req, res) => {
  res.json(await restaurantService.getRestaurant());
});

function validateFees(body) {
  const num = (v) => (v === '' || v == null ? 0 : Number(v));
  const vat = num(body.vat_percent);
  const svc = num(body.service_fee_percent);
  const delivery = num(body.delivery_fee);
  if (![vat, svc].every((n) => Number.isFinite(n) && n >= 0 && n <= 100)) throw new AppError(400, 'ƏDV və servis haqqı 0–100% arasında olmalıdır');
  if (!Number.isFinite(delivery) || delivery < 0) throw new AppError(400, 'Çatdırılma haqqı mənfi ola bilməz');
  if (body.currency && !/^[A-Z]{3}$/.test(body.currency)) throw new AppError(400, 'Valyuta 3 böyük hərfli kod olmalıdır (məs. AZN)');
  body.vat_percent = vat;
  body.service_fee_percent = svc;
  body.delivery_fee = delivery;
}

exports.updateRestaurant = asyncHandler(async (req, res) => {
  if (!req.body.name || !String(req.body.name).trim()) throw new AppError(400, 'Restoran adı tələb olunur');
  validateFees(req.body);
  const before = await restaurantService.getRestaurant();
  const restaurant = await restaurantService.updateRestaurant(req.body);
  await auditService.log(req, 'restaurant.update', 'restaurants', restaurant.id, before, restaurant);
  res.json(restaurant);
});
