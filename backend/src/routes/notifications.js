const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { requireAdmin } = require('../middleware/auth');

router.get('/', requireAdmin, notificationController.getAllNotifications);
router.patch('/:id/read', requireAdmin, notificationController.markRead);
router.patch('/read-all', requireAdmin, notificationController.markAllRead);

module.exports = router;
