const express = require('express');
const router = express.Router();
const tableController = require('../controllers/tableController');
const { requireAdmin, authorize } = require('../middleware/auth');

router.get('/', requireAdmin, authorize('OWNER', 'MANAGER', 'WAITER'), tableController.getAllTables);
router.get('/:id', requireAdmin, authorize('OWNER', 'MANAGER', 'WAITER'), tableController.getTableById);
router.post('/', requireAdmin, authorize('OWNER', 'MANAGER'), tableController.createTable);
router.put('/:id', requireAdmin, authorize('OWNER', 'MANAGER'), tableController.updateTable);
router.post('/:id/regenerate', requireAdmin, authorize('OWNER', 'MANAGER'), tableController.regenerateQr);
router.delete('/:id', requireAdmin, authorize('OWNER', 'MANAGER'), tableController.deleteTable);

// Açıq (public) — müştəri menyu səhifəsi masa QR-i ilə yükləndikdə çağırır
router.post('/:code/scan', tableController.scanTable);
router.post('/:code/call-waiter', tableController.callWaiter);
router.post('/:code/request-bill', tableController.requestBill);

module.exports = router;
