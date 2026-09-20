require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = rateLimit;
const { poolPromise } = require('./config/db');
const { getSocketStats } = require('./sockets/emit');
const errorHandler = require('./middleware/errorHandler');
const csrfGuard = require('./middleware/csrfGuard');
const { optionalAdmin } = require('./middleware/auth');
const { securityHeaders } = require('./middleware/securityHeaders');

const authRoutes = require('./routes/auth');
const restaurantRoutes = require('./routes/restaurant');
const categoryRoutes = require('./routes/categories');
const productRoutes = require('./routes/products');
const tableRoutes = require('./routes/tables');
const orderRoutes = require('./routes/orders');
const paymentRoutes = require('./routes/payments');
const mailSettingsRoutes = require('./routes/mailSettings');
const adminRoutes = require('./routes/admin');
const notificationRoutes = require('./routes/notifications');
const promoRoutes = require('./routes/promos');
const auditRoutes = require('./routes/audit');
const staffRoutes = require('./routes/staff');
const uploadRoutes = require('./routes/upload');
const reviewRoutes = require('./routes/reviews');
const mediaRoutes = require('./routes/media');
const insightRoutes = require('./routes/insights');
const allergenRoutes = require('./routes/allergens');
const ingredientRoutes = require('./routes/ingredients');
const createSpaRouter = require('./routes/spa');

const app = express();
const SLOW_REQUEST_MS = 1000;

// Reverse proxy (nginx/Cloudflare) arxasında real IP-ni görmək üçün (rate limit düzgün işləsin)
if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1);

app.disable('x-powered-by');
app.use(securityHeaders);

// API cavab monitorinqi: yavaş sorğuları (>1s) logla
app.use('/api', (req, res, next) => {
  const started = process.hrtime.bigint();
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - started) / 1e6;
    if (ms > SLOW_REQUEST_MS) console.warn(`[YAVAŞ] ${req.method} ${req.originalUrl} ${res.statusCode} ${ms.toFixed(0)}ms`);
  });
  next();
});

app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5174', credentials: true, exposedHeaders: ['X-Has-More'] }));
app.use('/api', csrfGuard); // cross-site state-dəyişən sorğular (CSRF) — şərh üçün middleware/csrfGuard.js
app.use(express.json());
app.use(cookieParser());
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads'), {
  maxAge: '30d',
  immutable: true,
  setHeaders: (res, file) => {
    if (file.endsWith('.avif')) res.setHeader('Content-Type', 'image/avif');
  },
}));

// Ümumi sorğu limiti — flood hücumlarına qarşı (bütün /api yollarına), IP üzrə.
// Restoran Wi-Fi-ında bütün müştərilər (və işçilər) BİR IP paylaşır, ona görə hədd yüksək saxlanılır (defolt 3000/15 dəq);
// sərt limitlər yalnız giriş və e-poçt axınlarındadır. Lazım olsa RATE_LIMIT_GENERAL ilə dəyişin.
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.RATE_LIMIT_GENERAL) || 3000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Çox sayda sorğu göndərildi, bir az sonra yenidən cəhd edin' },
});
app.use('/api', generalLimiter);

// Admin girişini brute-force hücumlarından qorumaq üçün iki qat (yalnız UĞURSUZ cəhdlər sayılır):
//  1) IP + e-poçt cütü üzrə 5/15 dəq — bir hesabı hədəf alan təxmin dayanır (hesab özü də 5 uğursuz cəhddən sonra kilidlənir);
//  2) yalnız IP üzrə 50/15 dəq — çoxlu hesabı yoxlayan hücum dayanır.
// Əvvəl yalnız IP üzrə 5 idi: restoran Wi-Fi-ında (bütün işçilər bir IP) bir müştəri/unudulmuş şifrə 15 dəqiqə HAMININ girişini bloklayırdı
// və şifrəni e-poçtla sıfırlayan işçi də yeni şifrəsi ilə daxil ola bilmirdi (QA tapıntısı).
const loginKeyByIpAndEmail = (req) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase().slice(0, 150) : '';
  return `${ipKeyGenerator(req.ip)}|${email}`;
};
const loginLimitMessage = { error: 'Çox sayda uğursuz giriş cəhdi. 15 dəqiqə sonra yenidən cəhd edin' };
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.LOGIN_LIMIT) || 5,
  keyGenerator: loginKeyByIpAndEmail,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: loginLimitMessage,
});
const loginIpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.LOGIN_IP_LIMIT) || 50,
  keyGenerator: (req) => ipKeyGenerator(req.ip),
  standardHeaders: false,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: loginLimitMessage,
});
// Sıra vacibdir: cütlük limiti əvvəl gəlir — artıq bloklanmış hesaba göndərilən sorğular IP sayğacını doldurmur
app.use('/api/auth/login', loginLimiter, loginIpLimiter);
// Şifrə e-poçtla sıfırlananda həmin IP+e-poçt sayğacı təmizlənir: əks halda istifadəçi yeni şifrəsi ilə 15 dəqiqə daxil ola bilmirdi
app.locals.resetLoginLimit = (req, email) => loginLimiter.resetKey(loginKeyByIpAndEmail({ ip: req.ip, body: { email } }));

// E-poçt göndərən/token yoxlayan endpoint-lər: IP üzrə sərt limit (spam məktub və token təxminetməyə qarşı)
const emailFlowLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.EMAIL_FLOW_LIMIT) || 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === 'GET', // yalnız oxuma (sahibin Ayarlar səhifəsi) limitə sayılmasın; məktub göndərən/token yoxlayan POST/PUT/DELETE limitlənir
  message: { error: 'Çox sayda sorğu göndərildi, 15 dəqiqə sonra yenidən cəhd edin' },
});
app.use(['/api/auth/forgot-password', '/api/auth/reset-password', '/api/auth/verify-email', '/api/auth/test-mail', '/api/auth/send-verification', '/api/auth/change-email', '/api/mail-settings'], emailFlowLimiter);

// İctimai sağlamlıq yoxlaması yalnız status verir; uptime/socket statistikası yalnız OWNER/MANAGER-ə (QA: məlumat sızması)
app.get('/api/health', optionalAdmin, async (req, res) => {
  const started = Date.now();
  try {
    const pool = await poolPromise;
    await pool.request().query('SELECT 1 AS ok');
    const detailed = req.admin && ['OWNER', 'MANAGER'].includes(req.admin.role);
    res.json({
      status: 'ok',
      database: 'qoşulub',
      ...(detailed && {
        db_latency_ms: Date.now() - started,
        uptime_s: Math.round(process.uptime()),
        sockets: getSocketStats(),
      }),
    });
  } catch (err) {
    console.error('Health check DB xətası:', err.message);
    res.status(500).json({ status: 'xəta', database: 'qoşulmayıb' });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/restaurant', restaurantRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/products', productRoutes);
app.use('/api/tables', tableRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/mail-settings', mailSettingsRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/promos', promoRoutes);
app.use('/api/audit-logs', auditRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/allergens', allergenRoutes);
app.use('/api/ingredients', ingredientRoutes);
app.use('/api/insights', insightRoutes);

// Production: build olunmuş frontend + dinamik SEO meta (dist yoxdursa heç nə etmir)
app.use(createSpaRouter());

app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint tapılmadı' });
});

app.use(errorHandler);

module.exports = app;
