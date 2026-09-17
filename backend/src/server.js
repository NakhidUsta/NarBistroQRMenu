require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const rateLimit = require('express-rate-limit');
const { poolPromise } = require('./config/db');
const { initSockets } = require('./sockets');
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
const uploadRoutes = require('./routes/upload');

const app = express();

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
  try {
    const pool = await poolPromise;
    await pool.request().query('SELECT 1 AS ok');
    res.json({ status: 'ok', database: 'qoşulub' });
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
app.use('/api/admin', adminRoutes);
app.use('/api/upload', uploadRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint tapılmadı' });
});

app.use(errorHandler);

const server = http.createServer(app);
initSockets(server);

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`QR Menu backend http://localhost:${PORT} ünvanında işləyir`);
});
