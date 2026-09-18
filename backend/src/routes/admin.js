const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { requireAdmin, authorize } = require('../middleware/auth');

router.get('/dashboard', requireAdmin, authorize('OWNER', 'MANAGER'), adminController.getDashboard);

module.exports = router;
