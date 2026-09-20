// Server açılışında sirlərin gücünü yoxlayır. JWT_SECRET həm giriş tokenlərinin imzasını, həm də bazada saxlanılan Gmail App Password-un
// şifrələmə açarını qoruyur — zəifdirsə hücumçu saxta admin tokeni yarada bilər.
// Production-da zəif sirlə server BAŞLAMIR; inkişafda yalnız xəbərdarlıq verilir.
const crypto = require('crypto');

const WEAK_WORDS = ['secret', 'changeme', 'change-this', 'change_this', 'password', 'default', 'example', 'jwt', 'qwerty', 'admin', '12345', 'abcde', 'test'];

function evaluateJwtSecret(secret) {
  const s = String(secret || '');
  const problems = [];
  if (!s) return ['JWT_SECRET təyin edilməyib'];
  if (s.length < 32) problems.push(`çox qısadır (${s.length} simvol; ən azı 32 olmalıdır)`);
  const lower = s.toLowerCase();
  const words = WEAK_WORDS.filter((w) => lower.includes(w));
  if (words.length) problems.push(`təxmin edilə bilən söz/ardıcıllıq ehtiva edir (${words.join(', ')})`);
  if (new Set(s).size < 12) problems.push('təkrarlanan simvollardan ibarətdir (təsadüfi deyil)');
  return problems;
}

const generateSecret = () => crypto.randomBytes(48).toString('base64url');

// production-da problem varsa Error atır; əks halda xəbərdarlıqları qaytarır (çağıran jurnala yazır)
function assertSecrets({ env = process.env } = {}) {
  const production = env.NODE_ENV === 'production';
  const warnings = [];
  const problems = evaluateJwtSecret(env.JWT_SECRET);
  if (problems.length) {
    const msg = `JWT_SECRET zəifdir: ${problems.join('; ')}. Yeni güclü açar yaradın: node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))" və backend/.env-ə yazın (köhnə sessiyalar bağlanacaq, paneldə saxlanmış Gmail şifrəsini yenidən daxil edin).`;
    if (production) throw new Error(`[TƏHLÜKƏSİZLİK] Server başlamır — ${msg}`);
    warnings.push(msg);
  }
  if (production) {
    if (!env.PUBLIC_URL) warnings.push('PUBLIC_URL təyin edilməyib — şifrə sıfırlama e-poçtu və ödəniş qayıdış linkləri localhost-a gedəcək.');
    if (env.PAYMENT_PROVIDER === 'test') warnings.push('PAYMENT_PROVIDER=test production-da işləmir (onlayn ödəniş söndürülür).');
  }
  return warnings;
}

module.exports = { evaluateJwtSecret, assertSecrets, generateSecret };
