const express = require('express');
const router = express.Router();
const reviewService = require('../services/reviewService');
const auditService = require('../services/auditService');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { requireAdmin, authorize } = require('../middleware/auth');

const validId = (v) => {
  const id = Number(v);
  if (!Number.isInteger(id) || id <= 0) throw new AppError(400, 'Yanlış ID');
  return id;
};

// Açıq (müştəri): təsdiqlənmiş rəylər + orta reytinq
router.get('/public', asyncHandler(async (req, res) => {
  res.json(await reviewService.publicReviews());
}));

// Açıq (müştəri, sifariş tokeni ilə): rəy yaza bilərmi / rəy yaz
router.get('/order/:id', asyncHandler(async (req, res) => {
  res.json(await reviewService.status(validId(req.params.id), req.query.token));
}));

router.post('/order/:id', asyncHandler(async (req, res) => {
  const review = await reviewService.createForOrder(validId(req.params.id), req.body.token, req.body);
  res.status(201).json(review);
}));

// Admin moderasiyası
router.get('/', requireAdmin, authorize('OWNER', 'MANAGER'), asyncHandler(async (req, res) => {
  res.json(await reviewService.listAll());
}));

router.patch('/:id', requireAdmin, authorize('OWNER', 'MANAGER'), asyncHandler(async (req, res) => {
  const id = validId(req.params.id);
  if (typeof req.body.is_approved !== 'boolean') throw new AppError(400, 'is_approved boolean olmalıdır');
  const review = await reviewService.setApproved(id, req.body.is_approved);
  await auditService.log(req, 'review.moderate', 'reviews', id, null, { is_approved: review.is_approved });
  res.json(review);
}));

router.delete('/:id', requireAdmin, authorize('OWNER', 'MANAGER'), asyncHandler(async (req, res) => {
  const id = validId(req.params.id);
  await reviewService.remove(id);
  await auditService.log(req, 'review.delete', 'reviews', id, null, null);
  res.status(204).send();
}));

module.exports = router;
