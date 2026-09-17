const restaurantRepository = require('../repositories/restaurantRepository');
const AppError = require('../utils/AppError');

const DEFAULT_RESTAURANT_ID = 1;

async function getRestaurant() {
  const restaurant = await restaurantRepository.find(DEFAULT_RESTAURANT_ID);
  if (!restaurant) throw new AppError(404, 'Restoran tapılmadı');
  return restaurant;
}

async function updateRestaurant(body) {
  const restaurant = await restaurantRepository.update(DEFAULT_RESTAURANT_ID, body);
  if (!restaurant) throw new AppError(404, 'Restoran tapılmadı');
  return restaurant;
}

module.exports = { getRestaurant, updateRestaurant };
