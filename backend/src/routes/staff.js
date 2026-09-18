const express = require('express');
const router = express.Router();
const staffService = require('../services/staffService');
const auditService = require('../services/auditService');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { requireAdmin, authorize } = require('../middleware/auth');

router.use(requireAdmin, authorize('OWNER'));

router.get('/', asyncHandler(async (req, res) => {
  res.json(await staffService.list());
}));

router.post('/', asyncHandler(async (req, res) => {
  const user = await staffService.create(req.body);
  await auditService.log(req, 'staff.create', 'admin_users', user.id, null, { email: user.email, role: user.role });
  res.status(201).json(user);
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new AppError(400, 'Yanlış ID');
  const user = await staffService.update(id, req.body, req.admin.id);
  await auditService.log(req, 'staff.update', 'admin_users', id, null, { email: user.email, role: user.role, password_changed: !!req.body.password });
  res.json(user);
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new AppError(400, 'Yanlış ID');
  await staffService.remove(id, req.admin.id);
  await auditService.log(req, 'staff.delete', 'admin_users', id, null, null);
  res.status(204).send();
}));

module.exports = router;
