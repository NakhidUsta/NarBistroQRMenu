const express = require('express');
const router = express.Router();
const insightService = require('../services/insightService');
const auditService = require('../services/auditService');
const asyncHandler = require('../utils/asyncHandler');
const { requireAdmin, authorize } = require('../middleware/auth');

router.use(requireAdmin, authorize('OWNER', 'MANAGER'));

router.get('/customers', asyncHandler(async (req, res) => {
  const q = req.query.q ? String(req.query.q).trim().slice(0, 100) : undefined;
  res.json(await insightService.customers(q));
}));

router.get('/inventory', asyncHandler(async (req, res) => {
  res.json(await insightService.inventory());
}));

function sendCsv(res, filename, csv) {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csv);
}

router.get('/reports/orders.csv', asyncHandler(async (req, res) => {
  const csv = await insightService.ordersCsv(req.query);
  await auditService.log(req, 'report.export', 'reports', 'orders', null, { from: req.query.from, to: req.query.to });
  sendCsv(res, `sifarisler_${req.query.from}_${req.query.to}.csv`, csv);
}));

router.get('/reports/products.csv', asyncHandler(async (req, res) => {
  const csv = await insightService.productsCsv(req.query);
  await auditService.log(req, 'report.export', 'reports', 'products', null, { from: req.query.from, to: req.query.to });
  sendCsv(res, `mehsul-satisi_${req.query.from}_${req.query.to}.csv`, csv);
}));

module.exports = router;
