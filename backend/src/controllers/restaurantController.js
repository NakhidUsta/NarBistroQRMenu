const restaurantService = require('../services/restaurantService');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');

exports.getRestaurant = asyncHandler(async (req, res) => {
  res.json(await restaurantService.getRestaurant());
});

exports.updateRestaurant = asyncHandler(async (req, res) => {
  if (!req.body.name || !String(req.body.name).trim()) throw new AppError(400, 'Restoran adı tələb olunur');
  res.json(await restaurantService.updateRestaurant(req.body));
});
