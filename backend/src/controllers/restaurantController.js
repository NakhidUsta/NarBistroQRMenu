const restaurantService = require('../services/restaurantService');
const auditService = require('../services/auditService');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');

exports.getRestaurant = asyncHandler(async (req, res) => {
  res.json(await restaurantService.getRestaurant());
});

exports.updateRestaurant = asyncHandler(async (req, res) => {
  if (!req.body.name || !String(req.body.name).trim()) throw new AppError(400, 'Restoran adı tələb olunur');
  const before = await restaurantService.getRestaurant();
  const restaurant = await restaurantService.updateRestaurant(req.body);
  await auditService.log(req, 'restaurant.update', 'restaurants', restaurant.id, before, restaurant);
  res.json(restaurant);
});
