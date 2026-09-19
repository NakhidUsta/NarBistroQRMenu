// Gmail (SMTP) qurulumunu yoxlayır — admin panelə girmədən, terminaldan:
//   npm run mail:test -- sizin@gmail.com
// .env-dəki SMTP_USER / SMTP_PASS istifadə olunur. Uğurlu olarsa poçt qutusuna sınaq məktubu gəlir.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mailService = require('../src/services/mailService');

async function main() {
  const to = process.argv[2] || process.env.SMTP_USER;
  if (!to) throw new Error('İstifadə: npm run mail:test -- sizin@gmail.com');
  if (!mailService.isConfigured()) {
    throw new Error('SMTP_USER və SMTP_PASS təyin edilməyib. backend/.env faylına Gmail ünvanını və 16 simvollu "Tətbiq şifrəsi"ni yazın (bax .env.example).');
  }
  console.log(`Sınaq məktubu göndərilir → ${to} ...`);
  await mailService.send({
    to,
    subject: 'QR Menu — e-poçt sınağı',
    text: 'Bu sınaq məktubudur. Bunu görürsünüzsə, Gmail qurulumu düzgündür və "Şifrəni unutdunuz?" məktubları çatacaq.',
    senderName: 'QR Menu',
  });
  console.log('✓ Göndərildi. Poçt qutunuzu (və Spam qovluğunu) yoxlayın.');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(`✗ ${err.message}`);
    process.exit(1);
  });
