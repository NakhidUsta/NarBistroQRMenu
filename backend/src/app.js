require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const rateLimit = require('express-rate-limit');
const { poolPromise } = require('./config/db');
const errorHandler = require('./middleware/errorHandler');

const authRoutes = require('./routes/auth');
const restaurantRoutes = require('./routes/restaurant');
const categoryRoutes = require('./routes/categories');
const productRoutes = require('./routes/products');
const tableRoutes = require('./routes/tables');
const orderRoutes = require('./routes/orders');
const adminRoutes = require('./routes/admin');
const notificationRoutes = require('./routes/notifications');
const promoRoutes = require('./routes/promos');
const auditRoutes = require('./routes/audit');
const staffRoutes = require('./routes/staff');
const uploadRoutes = require('./routes/upload');
const reviewRoutes = require('./routes/reviews');
const insightRoutes = require('./routes/insights');

const app = express();
const SLOW_REQUEST_MS = 1000;

// Reverse proxy (nginx/Cloudflare) arxasında real IP-ni görmək üçün (rate limit düzgün işləsin)
if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1);

app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// API cavab monitorinqi: yavaş sorğuları (>1s) logla
app.use('/api', (req, res, next) => {
  const started = process.hrtime.bigint();
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - started) / 1e6;
    if (ms > SLOW_REQUEST_MS) console.warn(`[YAVAŞ] ${req.method} ${req.originalUrl} ${res.statusCode} ${ms.toFixed(0)}ms`);
  });
  next();
});

app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5174', credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Ümumi sorğu limiti — sui-istifadə/flood hücumlarına qarşı (bütün /api yollarına)
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Çox sayda sorğu göndərildi, bir az sonra yenidən cəhd edin' },
});
app.use('/api', generalLimiter);

// Sərt limit — admin girişini brute-force hücumlarından qorumaq üçün
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { error: 'Çox sayda uğursuz giriş cəhdi. 15 dəqiqə sonra yenidən cəhd edin' },
});
app.use('/api/auth/login', loginLimiter);

app.get('/api/health', async (req, res) => {
  const started = Date.now();
  try {
    const pool = await poolPromise;
    await pool.request().query('SELECT 1 AS ok');
    res.json({
      status: 'ok',
      database: 'qoşulub',
      db_latency_ms: Date.now() - started,
      uptime_s: Math.round(process.uptime()),
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
app.use('/api/notifications', notificationRoutes);
app.use('/api/promos', promoRoutes);
app.use('/api/audit-logs', auditRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/insights', insightRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint tapılmadı' });
});

app.use(errorHandler);

module.exports = app;
