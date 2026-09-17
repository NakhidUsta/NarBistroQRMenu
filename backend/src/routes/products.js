const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { requireAdmin, authorize, optionalAdmin } = require('../middleware/auth');

router.get('/', optionalAdmin, productController.getAllProducts);
router.get('/:id', productController.getProductById);
router.post('/', requireAdmin, authorize('OWNER', 'MANAGER'), productController.createProduct);
router.put('/:id', requireAdmin, authorize('OWNER', 'MANAGER'), productController.updateProduct);
router.patch('/:id/availability', requireAdmin, authorize('OWNER', 'MANAGER', 'KITCHEN'), productController.setAvailability);
router.patch('/:id/stock', requireAdmin, authorize('OWNER', 'MANAGER'), productController.adjustStock);
router.delete('/:id', requireAdmin, authorize('OWNER', 'MANAGER'), productController.deleteProduct);

module.exports = router;
