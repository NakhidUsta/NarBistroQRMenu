const express = require('express');
const router = express.Router();
const allergenService = require('../services/allergenService');
const asyncHandler = require('../utils/asyncHandler');

// Standart allergen kataloqu (AB-nin 14 allergeni, AZ/EN/RU) — müştəri UI-ı və admin məhsul formu üçün açıq
router.get('/', asyncHandler(async (req, res) => {
  res.json(await allergenService.list());
}));

module.exports = router;
