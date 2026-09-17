const fs = require('fs/promises');
const path = require('path');

const ALLOWED_TYPES = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
};

exports.uploadFile = async (req, res) => {
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

    const safeExt = `.${detected.ext}`;
    if (path.extname(filePath).toLowerCase() !== safeExt) {
      const safePath = filePath.slice(0, -path.extname(filePath).length) + safeExt;
      await fs.rename(filePath, safePath);
      req.file.filename = path.basename(safePath);
    }

    res.status(201).json({ url: `/uploads/${req.file.filename}` });
  } catch (err) {
    await fs.unlink(filePath).catch(() => {});
    console.error(err);
    res.status(500).json({ error: 'Şəkil yoxlanılarkən xəta baş verdi' });
  }
};
