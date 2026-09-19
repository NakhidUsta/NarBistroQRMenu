const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');
const mediaRepository = require('../repositories/mediaRepository');
const { UPLOAD_DIR } = require('../config/uploads');
const AppError = require('../utils/AppError');

const DEFAULT_RESTAURANT_ID = 1;
const MIME = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' };
const BASE_RE = /^m-\d{13}-[a-f0-9]{8}$/;
const ASPECTS = { '1:1': 1, '4:3': 4 / 3, '16:9': 16 / 9 };

// variant açarı → [fayl şəkilçisi, eni, format]
const VARIANTS = {
  thumb: ['-thumb.webp', 240, 'webp'],
  md: ['-md.webp', 640, 'webp'],
  lg: ['-lg.webp', 1280, 'webp'],
  md_avif: ['-md.avif', 640, 'avif'],
  lg_avif: ['-lg.avif', 1280, 'avif'],
};

const limits = { limitInputPixels: 50_000_000 }; // ~50MP — "decompression bomb" şəkillərə qarşı

function urlsFor(media) {
  const base = `/uploads/${media.base_name}`;
  return {
    url: `${base}.${media.ext}`,
    variants: Object.fromEntries(Object.entries(VARIANTS).map(([k, [suffix]]) => [k, `${base}${suffix}`])),
  };
}

function present(media, usedUrls) {
  const { url, variants } = urlsFor(media);
  return { ...media, url, variants, in_use: usedUrls ? usedUrls.has(url) : undefined };
}

async function makeVariants(originalPath, base) {
  for (const [, [suffix, width, format]] of Object.entries(VARIANTS)) {
    const img = sharp(originalPath, limits).rotate().resize({ width, withoutEnlargement: true });
    await (format === 'avif' ? img.avif({ quality: 50 }) : img.webp({ quality: 78 })).toFile(path.join(UPLOAD_DIR, `${base}${suffix}`));
  }
}

// Doğrulanmış (magic-byte) faylı Media Library-yə qəbul edir:
// adı dəyişir, EXIF/GPS metaməlumatını təmizləyir, variantlar yaradır, DB-yə yazır.
async function register(tempPath, ext, { parentId } = {}) {
  const base = `m-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const finalPath = path.join(UPLOAD_DIR, `${base}.${ext}`);
  const created = [];
  try {
    if (ext === 'gif') {
      await fs.rename(tempPath, finalPath); // animasiyanı qoru
    } else {
      // sharp default olaraq bütün metaməlumatı (EXIF, GPS) atır; rotate() EXIF istiqamətini piksellərə tətbiq edir
      const pipeline = sharp(tempPath, limits).rotate();
      await (ext === 'png' ? pipeline.png() : ext === 'webp' ? pipeline.webp({ quality: 90 }) : pipeline.jpeg({ quality: 88 })).toFile(finalPath);
      await fs.unlink(tempPath).catch(() => {});
    }
    created.push(finalPath);

    const meta = await sharp(finalPath, limits).metadata();
    await makeVariants(finalPath, base);
    Object.values(VARIANTS).forEach(([suffix]) => created.push(path.join(UPLOAD_DIR, `${base}${suffix}`)));

    const stat = await fs.stat(finalPath);
    const row = await mediaRepository.insert({
      restaurant_id: DEFAULT_RESTAURANT_ID,
      base_name: base,
      ext,
      mime: MIME[ext],
      width: meta.width,
      height: meta.height,
      size_bytes: stat.size,
      parent_id: parentId,
    });
    return present(row);
  } catch (err) {
    await Promise.all([tempPath, ...created].map((f) => fs.unlink(f).catch(() => {})));
    if (err instanceof AppError) throw err;
    if (/pixel|input|unsupported|corrupt|VipsJpeg|premature/i.test(err.message)) throw new AppError(400, 'Şəkil emal oluna bilmədi (zədəli və ya çox böyük fayl)');
    throw err;
  }
}

async function list() {
  const [rows, used] = await Promise.all([mediaRepository.findAll(), mediaRepository.findUsedUrls()]);
  return rows.map((m) => present(m, used));
}

async function remove(id) {
  const media = await mediaRepository.findById(id);
  if (!media) throw new AppError(404, 'Şəkil tapılmadı');
  const used = await mediaRepository.findUsedUrls();
  if (used.has(urlsFor(media).url)) throw new AppError(409, 'Bu şəkil məhsulda, loqoda və ya hero-da istifadə olunur — əvvəlcə onu dəyişin');

  if (!BASE_RE.test(media.base_name)) throw new AppError(500, 'Yanlış fayl adı');
  const files = [`${media.base_name}.${media.ext}`, ...Object.values(VARIANTS).map(([suffix]) => `${media.base_name}${suffix}`)];
  await Promise.all(files.map((f) => fs.rm(path.join(UPLOAD_DIR, f), { force: true })));
  await mediaRepository.remove(id);
}

// "Smart crop": seçilmiş nisbətə görə mərkəzdən və ya diqqətçəkən (attention) nöqtəyə görə kəsir; yeni şəkil kimi saxlanılır.
async function crop(id, { aspect, focus }) {
  const media = await mediaRepository.findById(id);
  if (!media) throw new AppError(404, 'Şəkil tapılmadı');
  const ratio = ASPECTS[aspect];
  if (!ratio) throw new AppError(400, `aspect bunlardan biri olmalıdır: ${Object.keys(ASPECTS).join(', ')}`);

  const width = Math.min(media.width, 1600);
  const height = Math.round(width / ratio);
  const tmp = path.join(UPLOAD_DIR, `crop-${Date.now()}-${crypto.randomBytes(3).toString('hex')}.${media.ext === 'gif' ? 'png' : media.ext}`);
  await sharp(path.join(UPLOAD_DIR, `${media.base_name}.${media.ext}`), limits)
    .resize({ width, height, fit: 'cover', position: focus === 'attention' ? sharp.strategy.attention : 'centre' })
    .toFile(tmp);
  return register(tmp, media.ext === 'gif' ? 'png' : media.ext, { parentId: id });
}

module.exports = { register, list, remove, crop, urlsFor, VARIANTS, BASE_RE };
