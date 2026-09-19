const express = require('express');
const router = express.Router();
const mediaService = require('../services/mediaService');
const auditService = require('../services/auditService');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { requireAdmin, authorize } = require('../middleware/auth');

router.use(requireAdmin, authorize('OWNER', 'MANAGER'));

const validId = (v) => {
  const id = Number(v);
  if (!Number.isInteger(id) || id <= 0) throw new AppError(400, 'Yanlış ID');
  return id;
};

router.get('/', asyncHandler(async (req, res) => {
  res.json(await mediaService.list());
}));

router.post('/:id/crop', asyncHandler(async (req, res) => {
  const id = validId(req.params.id);
  const media = await mediaService.crop(id, { aspect: req.body.aspect, focus: req.body.focus });
  await auditService.log(req, 'media.crop', 'media', media.id, null, { from: id, aspect: req.body.aspect });
  res.status(201).json(media);
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const id = validId(req.params.id);
  await mediaService.remove(id);
  await auditService.log(req, 'media.delete', 'media', id, null, null);
  res.status(204).send();
}));

module.exports = router;
