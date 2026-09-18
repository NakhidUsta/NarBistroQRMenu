const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { requireAdmin, authorize, optionalAdmin } = require('../middleware/auth');

router.post('/', orderController.createOrder);
router.post('/quote', orderController.quoteOrder);
router.get('/', requireAdmin, orderController.getAllOrders);
router.get('/:id', optionalAdmin, orderController.getOrderById);
router.put('/:id', requireAdmin, authorize('OWNER', 'MANAGER', 'WAITER', 'KITCHEN'), orderController.updateOrderStatus);

module.exports = router;
