const express = require('express');
const router = express.Router();
const auditService = require('../services/auditService');
const asyncHandler = require('../utils/asyncHandler');
const { parsePage, sendPage } = require('../utils/pagination');
const { requireAdmin, authorize } = require('../middleware/auth');

router.get('/', requireAdmin, authorize('OWNER', 'MANAGER'), asyncHandler(async (req, res) => {
  const { limit, before } = parsePage(req.query);
  const rows = await auditService.list({ entity_type: req.query.entity_type, limit: limit + 1, before });
  res.json(sendPage(res, rows, limit));
}));

module.exports = router;
