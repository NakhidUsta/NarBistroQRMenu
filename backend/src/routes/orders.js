const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const paymentController = require('../controllers/paymentController');
const { requireAdmin, authorize, optionalAdmin } = require('../middleware/auth');

router.post('/', orderController.createOrder);
router.post('/quote', orderController.quoteOrder);
router.get('/', requireAdmin, orderController.getAllOrders);
router.get('/:id', optionalAdmin, orderController.getOrderById);
router.post('/:id/payment', requireAdmin, authorize('OWNER', 'MANAGER', 'WAITER'), paymentController.markPaid);
router.post('/:id/refund', requireAdmin, authorize('OWNER', 'MANAGER'), paymentController.refund);
router.get('/:id/payments', requireAdmin, paymentController.list);
router.put('/:id', requireAdmin, authorize('OWNER', 'MANAGER', 'WAITER', 'KITCHEN'), orderController.updateOrderStatus);

module.exports = router;
