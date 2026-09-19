const fs = require('fs/promises');
const mediaService = require('../services/mediaService');
const auditService = require('../services/auditService');

const ALLOWED_TYPES = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
};

exports.uploadFile = async (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Şəkil tapılmadı' });
  }

  const filePath = req.file.path;

  try {
    // Client-in bəyan etdiyi mimetype/uzantı deyil, faylın öz bayt-imzasına (magic bytes) baxırıq —
    // bu, "şəkil.jpg" adı ilə göndərilən .html/.exe kimi saxta fayllara qarşı əsl müdafiədir.
    const { fileTypeFromFile } = await import('file-type');
    const detected = await fileTypeFromFile(filePath);

    if (!detected || !ALLOWED_TYPES[detected.ext]) {
      await fs.unlink(filePath).catch(() => {});
      return res.status(400).json({ error: 'Yalnız JPG, PNG, WEBP və ya GIF şəkilləri qəbul olunur' });
    }

    // Media Library: metaməlumat təmizlənir, thumb/md/lg (WebP/AVIF) variantları yaradılır
    const media = await mediaService.register(filePath, detected.ext);
    await auditService.log(req, 'media.upload', 'media', media.id, null, { url: media.url, size: media.size_bytes });
    res.status(201).json({ url: media.url, media });
  } catch (err) {
    await fs.unlink(filePath).catch(() => {});
    next(err);
  }
};
