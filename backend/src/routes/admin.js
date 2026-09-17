const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { requireAdmin } = require('../middleware/auth');

router.get('/dashboard', requireAdmin, adminController.getDashboard);

module.exports = router;
