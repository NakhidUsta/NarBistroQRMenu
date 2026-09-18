const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const uploadController = require('../controllers/uploadController');
const { requireAdmin, authorize } = require('../middleware/auth');

const uploadDir = path.join(__dirname, '..', '..', 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Yalnız şəkil faylları qəbul olunur'));
    }
    cb(null, true);
  },
});

router.post('/', requireAdmin, authorize('OWNER', 'MANAGER'), (req, res, next) => {
  upload.single('image')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'Şəkil 5MB-dan böyük ola bilməz' });
      }
      return res.status(400).json({ error: err.message || 'Fayl yüklənərkən xəta baş verdi' });
    }
    next();
  });
}, uploadController.uploadFile);

module.exports = router;
