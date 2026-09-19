const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const paymentController = require('../controllers/paymentController');

// Müştəri tərəfli ödəniş sorğuları: restoran Wi-Fi-ı bir IP paylaşır, ona görə hədd mülayimdir
const customerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.PAYMENT_RATE_LIMIT) || 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Çox sayda sorğu göndərildi, bir az sonra yenidən cəhd edin' },
});

router.post('/orders/:id/start', customerLimiter, paymentController.start);
router.post('/orders/:id/verify', customerLimiter, paymentController.verify);
router.post('/test/complete', customerLimiter, paymentController.testComplete);
// Provayder callback-i form-urlencoded gəlir (data, signature); IP limiti yoxdur — imza ilə qorunur
router.post('/epoint/callback', express.urlencoded({ extended: false, limit: '20kb' }), paymentController.epointCallback);

module.exports = router;
