const adminService = require('../services/adminService');
const asyncHandler = require('../utils/asyncHandler');

exports.getDashboard = asyncHandler(async (req, res) => {
  res.json(await adminService.getDashboard(req.query));
});
