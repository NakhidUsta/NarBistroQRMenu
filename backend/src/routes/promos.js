const express = require('express');
const router = express.Router();
const promoController = require('../controllers/promoController');
const { requireAdmin, authorize } = require('../middleware/auth');

router.get('/', requireAdmin, authorize('OWNER', 'MANAGER'), promoController.getAllPromoCodes);
router.post('/', requireAdmin, authorize('OWNER', 'MANAGER'), promoController.createPromoCode);
router.put('/:id', requireAdmin, authorize('OWNER', 'MANAGER'), promoController.updatePromoCode);
router.delete('/:id', requireAdmin, authorize('OWNER', 'MANAGER'), promoController.deletePromoCode);

module.exports = router;
