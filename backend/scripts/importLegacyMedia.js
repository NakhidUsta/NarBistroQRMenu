// Media kitabxanasından əvvəl yüklənmiş şəkilləri (uploads/<vaxt>-<rəqəm>.<uzantı>) kitabxanaya köçürür:
// EXIF təmizlənir, WebP/AVIF variantları yaradılır və məhsul/loqo/hero istinadları yeni linkə yönləndirilir.
//   npm run media:import                 # köçür (köhnə fayllar qalır — açıq ekranlar sınmasın)
//   npm run media:import -- --dry-run    # yalnız nəyin köçürüləcəyini göstər
//   npm run media:import -- --delete-old # köçürdükdən sonra köhnə faylları da sil
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs/promises');
const path = require('path');
const { poolPromise, sql } = require('../src/config/db');
const { UPLOAD_DIR } = require('../src/config/uploads');
const mediaService = require('../src/services/mediaService');

const LEGACY_NAME = /^\d{13}-\d+\.(jpe?g|png|webp|gif)$/i;
const ALLOWED = { jpg: true, png: true, webp: true, gif: true };

async function repoint(pool, oldUrl, newUrl) {
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    const run = (query) => new sql.Request(tx).input('o', sql.NVarChar(sql.MAX), oldUrl).input('n', sql.NVarChar(sql.MAX), newUrl).query(query);
    const counts = [];
    // Yalnız tam uyğunluq: məhsul/qalereya/loqo sütunları; tema JSON-unda isə dırnaqla əhatə olunmuş dəyər
    counts.push((await run('UPDATE products SET image_url = @n WHERE image_url = @o')).rowsAffected[0]);
    counts.push((await run('UPDATE product_images SET image_url = @n WHERE image_url = @o')).rowsAffected[0]);
    counts.push((await run('UPDATE restaurants SET logo_url = @n WHERE logo_url = @o')).rowsAffected[0]);
    counts.push((await run(`UPDATE restaurants SET theme = REPLACE(theme, '"' + @o + '"', '"' + @n + '"') WHERE theme LIKE '%' + @o + '%'`)).rowsAffected[0]);
    await tx.commit();
    return counts.reduce((a, b) => a + b, 0);
  } catch (err) {
    await tx.rollback();
    throw err;
  }
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const deleteOld = process.argv.includes('--delete-old');
  const { fileTypeFromFile } = await import('file-type');
  const pool = await poolPromise;

  const files = (await fs.readdir(UPLOAD_DIR)).filter((f) => LEGACY_NAME.test(f)).sort();
  if (!files.length) return console.log('Köçürüləcək köhnə şəkil yoxdur.');

  let imported = 0;
  let skipped = 0;
  for (const file of files) {
    const source = path.join(UPLOAD_DIR, file);
    const detected = await fileTypeFromFile(source).catch(() => null);
    if (!detected || !ALLOWED[detected.ext]) {
      console.warn(`ATLANDI (şəkil deyil/zədəli): ${file}`);
      skipped += 1;
      continue;
    }
    if (dryRun) {
      console.log(`köçürüləcək: ${file} (${detected.ext})`);
      continue;
    }

    // register() mənbə faylı silir — ona görə nüsxə ilə işləyirik, orijinal istinadlar yenilənənə qədər toxunulmaz qalır
    const copy = path.join(UPLOAD_DIR, `legacy-copy-${file}`);
    await fs.copyFile(source, copy);
    try {
      const media = await mediaService.register(copy, detected.ext);
      const refs = await repoint(pool, `/uploads/${file}`, media.url);
      console.log(`${file} → ${path.basename(media.url)} (${refs} istinad yeniləndi)`);
      if (deleteOld) await fs.rm(source, { force: true });
      imported += 1;
    } catch (err) {
      console.error(`XƏTA ${file}: ${err.message}`);
      skipped += 1;
    }
  }
  console.log(dryRun ? `Quru işə salma: ${files.length} fayl.` : `Bitdi: ${imported} köçürüldü, ${skipped} atlandı.${deleteOld ? '' : ' Köhnə fayllar saxlanıldı (--delete-old ilə silə bilərsiniz).'}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
