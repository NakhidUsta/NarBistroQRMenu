const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');
const { requireAdmin, authorize, optionalAdmin } = require('../middleware/auth');

router.get('/', optionalAdmin, categoryController.getAllCategories);
router.get('/:id', categoryController.getCategoryById);
router.post('/', requireAdmin, authorize('OWNER', 'MANAGER'), categoryController.createCategory);
router.put('/:id', requireAdmin, authorize('OWNER', 'MANAGER'), categoryController.updateCategory);
router.delete('/:id', requireAdmin, authorize('OWNER', 'MANAGER'), categoryController.deleteCategory);

module.exports = router;
