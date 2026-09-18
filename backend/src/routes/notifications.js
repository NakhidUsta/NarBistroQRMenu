const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { requireAdmin, authorize } = require('../middleware/auth');

const staffRoles = authorize('OWNER', 'MANAGER', 'WAITER');
router.get('/', requireAdmin, staffRoles, notificationController.getAllNotifications);
router.patch('/read-all', requireAdmin, staffRoles, notificationController.markAllRead);
router.patch('/:id/read', requireAdmin, staffRoles, notificationController.markRead);
router.delete('/read', requireAdmin, staffRoles, notificationController.removeAllRead);
router.delete('/:id', requireAdmin, staffRoles, notificationController.remove);

module.exports = router;
