// SQL Server tam backup (sıxılmış, CHECKSUM ilə) + RESTORE VERIFYONLY yoxlaması + köhnə faylların təmizlənməsi.
//   npm run backup
// Backup faylı SQL Server-in İŞLƏDİYİ maşında yazılır. Qovluq: BACKUP_DIR (env) və ya SQL Server-in defolt backup yolu.
// SQL Server xidmət hesabının həmin qovluğa yazma icazəsi olmalıdır.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const { sql, poolPromise } = require('../src/config/db');

const RETENTION_DAYS = Number(process.env.BACKUP_RETENTION_DAYS) || 14;

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
}

async function main() {
  const pool = await poolPromise;
  const dbName = process.env.DB_NAME || 'qr_menu';

  let dir = process.env.BACKUP_DIR;
  if (!dir) {
    const r = await pool.request().query("SELECT CAST(SERVERPROPERTY('InstanceDefaultBackupPath') AS NVARCHAR(500)) AS p");
    dir = r.recordset[0].p;
  }
  if (!dir) throw new Error('Backup qovluğu tapılmadı — .env-də BACKUP_DIR təyin edin');

  const file = path.join(dir, `${dbName}_${stamp()}.bak`);
  console.log(`Backup başlayır: ${file}`);

  // Fayl yolu və DB adı parametr kimi ötürülə bilmir (BACKUP sintaksisi) — DB adı yalnız [A-Za-z0-9_] ola bilər.
  if (!/^[A-Za-z0-9_]+$/.test(dbName)) throw new Error('DB_NAME yalnız hərf, rəqəm və _ ola bilər');
  await pool.request()
    .input('file', sql.NVarChar(500), file)
    .query(`BACKUP DATABASE [${dbName}] TO DISK = @file WITH INIT, COMPRESSION, CHECKSUM, NAME = N'${dbName} tam backup'`);
  console.log('Backup yazıldı (CHECKSUM ilə — səhifə bütövlüyü backup zamanı yoxlanılır).');

  // RESTORE VERIFYONLY məhdud icazəli hesabda (CREATE DATABASE hüququ olmadan) işləmir — bu halda xəbərdarlıq edib davam edirik.
  try {
    await pool.request()
      .input('file', sql.NVarChar(500), file)
      .query('RESTORE VERIFYONLY FROM DISK = @file WITH CHECKSUM');
    console.log('RESTORE VERIFYONLY uğurlu.');
  } catch (err) {
    const denied = /permission denied/i.test(err.message) || (err.precedingErrors || []).some((e) => /permission denied/i.test(e.message));
    if (denied) {
      console.warn('XƏBƏRDARLIQ: RESTORE VERIFYONLY icazə çatışmazlığına görə atlandı. Vaxtaşırı sysadmin ilə əl ilə yoxlayın:');
      console.warn(`  RESTORE VERIFYONLY FROM DISK = N'${file}' WITH CHECKSUM`);
    } else {
      throw err;
    }
  }

  // Köhnə backup-ların təmizlənməsi (yalnız qovluğa bu prosesdən çıxış varsa)
  try {
    const limit = Date.now() - RETENTION_DAYS * 86400_000;
    for (const f of fs.readdirSync(dir)) {
      if (!new RegExp(`^${dbName}_\\d{8}_\\d{4}\\.bak$`).test(f)) continue;
      const full = path.join(dir, f);
      if (fs.statSync(full).mtimeMs < limit) {
        fs.unlinkSync(full);
        console.log(`Köhnə backup silindi: ${f}`);
      }
    }
  } catch {
    console.log('Köhnə backup-ların təmizlənməsi atlandı (qovluğa çıxış yoxdur).');
  }
  return file;
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Backup XƏTASI:', err.message);
    process.exit(1);
  });
