const express = require('express');
const router = express.Router();
const auditService = require('../services/auditService');
const asyncHandler = require('../utils/asyncHandler');
const { requireAdmin, authorize } = require('../middleware/auth');

router.get('/', requireAdmin, authorize('OWNER', 'MANAGER'), asyncHandler(async (req, res) => {
  res.json(await auditService.list({ entity_type: req.query.entity_type }));
}));

module.exports = router;
