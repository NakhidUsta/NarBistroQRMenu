const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { requireAdmin } = require('../middleware/auth');

router.post('/login', authController.login);
router.post('/logout', authController.logout);
router.get('/me', requireAdmin, authController.me);
router.post('/change-password', requireAdmin, authController.changePassword);
router.post('/logout-all', requireAdmin, authController.logoutEverywhere);

module.exports = router;
