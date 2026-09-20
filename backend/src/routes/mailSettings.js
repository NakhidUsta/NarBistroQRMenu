const express = require('express');
const router = express.Router();
const mailSettingsService = require('../services/mailSettingsService');
const auditService = require('../services/auditService');
const asyncHandler = require('../utils/asyncHandler');
const { requireAdmin, authorize } = require('../middleware/auth');

// Yalnız OWNER: Gmail girişi restoranın ən həssas ayarlarındandır
router.use(requireAdmin, authorize('OWNER'));

router.get('/', asyncHandler(async (req, res) => {
  res.json(await mailSettingsService.getStatus());
}));

router.put('/', asyncHandler(async (req, res) => {
  const status = await mailSettingsService.save(req.body || {}, req.admin.id);
  // audit logda şifrə YOXDUR, yalnız ünvan
  await auditService.log(req, 'mail.settings_save', 'mail_settings', 1, null, { smtp_user: status.smtp_user });
  res.json({ ...status, message: 'Gmail qoşuldu — şifrəni unutdum məktubları indi göndəriləcək.' });
}));

router.delete('/', asyncHandler(async (req, res) => {
  await auditService.log(req, 'mail.settings_remove', 'mail_settings', 1, null, null);
  res.json(await mailSettingsService.remove());
}));

router.post('/test', asyncHandler(async (req, res) => {
  const { to } = await mailSettingsService.sendTest();
  res.json({ to, message: `Sınaq məktubu ${to} ünvanına göndərildi — poçt qutusunu (və Spam qovluğunu) yoxlayın.` });
}));

module.exports = router;
