const express = require('express');
const router = express.Router();
const restaurantController = require('../controllers/restaurantController');
const { requireAdmin, authorize } = require('../middleware/auth');

router.get('/', restaurantController.getRestaurant);
router.put('/', requireAdmin, authorize('OWNER', 'MANAGER'), restaurantController.updateRestaurant);

module.exports = router;
