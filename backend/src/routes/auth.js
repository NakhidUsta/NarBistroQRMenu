const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { requireAdmin, authorize } = require('../middleware/auth');

router.post('/login', authController.login);
router.get('/config', authController.config);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);
router.post('/verify-email', authController.verifyEmail);
router.post('/send-verification', requireAdmin, authController.sendVerification);
router.post('/test-mail', requireAdmin, authorize('OWNER'), authController.testMail);
router.post('/refresh', authController.refresh);
router.post('/logout', authController.logout);
router.get('/sessions', requireAdmin, authController.listSessions);
router.delete('/sessions/:id', requireAdmin, authController.revokeSession);
router.get('/me', requireAdmin, authController.me);
router.post('/change-password', requireAdmin, authController.changePassword);
router.post('/logout-all', requireAdmin, authController.logoutEverywhere);

module.exports = router;
