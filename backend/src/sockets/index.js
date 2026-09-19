const { Server } = require('socket.io');
const authService = require('../services/authService');
const orderService = require('../services/orderService');
const { setIO, recordAck } = require('./emit');

// Heartbeat: server 25 san-də bir ping göndərir, 20 san ərzində pong gəlməsə bağlantı ölü sayılır.
// Qısa (2 dəq) kəsilmələrdə itirilmiş hadisələr və otaq üzvlükləri bərpa olunur (connectionStateRecovery);
// admin namespace-də orta qat (JWT yoxlaması) bərpa zamanı da işləyir — ləğv edilmiş sessiya bərpa oluna bilməz.
const SOCKET_OPTIONS = {
  pingInterval: 25000,
  pingTimeout: 20000,
  connectionStateRecovery: { maxDisconnectionDuration: 2 * 60 * 1000, skipMiddlewares: false },
};

function parseCookie(cookieHeader, name) {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(';').map((p) => p.trim());
  for (const part of parts) {
    if (part.startsWith(`${name}=`)) {
      return decodeURIComponent(part.slice(name.length + 1));
    }
  }
  return null;
}

const reply = (ack, payload) => typeof ack === 'function' && ack(payload);

function initSockets(httpServer) {
  const io = new Server(httpServer, {
    ...SOCKET_OPTIONS,
    cors: {
      origin: process.env.CLIENT_ORIGIN || 'http://localhost:5174',
      credentials: true,
    },
  });

  // Müştəri (public) namespace — masa QR-i ilə açılan menyu/sifariş-izləmə ekranları
  io.on('connection', (socket) => {
    const table = socket.handshake.query?.table;
    if (table) socket.join(`table:${String(table).slice(0, 60)}`);

    // Sifariş otağına yalnız sifarişin gizli tokenini bilən qoşula bilər (ID təxmin edilə bilər, token edilə bilməz).
    // Cavab (ack) klientə qoşulmanın uğurlu olduğunu bildirir — bağlantı bərpasında otaq yenidən tələb olunur.
    socket.on('join-order', async (payload, ack) => {
      try {
        const id = Number(typeof payload === 'object' && payload ? payload.id : payload);
        const token = typeof payload === 'object' && payload ? payload.token : undefined;
        if (!Number.isInteger(id) || id <= 0 || typeof token !== 'string') return reply(ack, { ok: false, error: 'invalid' });
        if (!(await orderService.hasAccess(id, token))) return reply(ack, { ok: false, error: 'forbidden' });
        socket.join(`order:${id}`);
        reply(ack, { ok: true });
      } catch {
        reply(ack, { ok: false, error: 'server' });
      }
    });

    socket.on('event-ack', recordAck);
    socket.on('disconnect', () => {});
  });

  // Admin namespace — JWT cookie ilə doğrulanır, rola görə əlavə room-a qoşulur
  const adminNamespace = io.of('/admin');

  adminNamespace.use(async (socket, next) => {
    try {
      const token = parseCookie(socket.handshake.headers.cookie, 'qrmenu_token');
      if (!token) return next(new Error('Giriş tələb olunur'));
      socket.admin = await authService.authenticate(token);
      next();
    } catch {
      next(new Error('Sessiya etibarsızdır'));
    }
  });

  adminNamespace.on('connection', (socket) => {
    socket.join('admin');
    socket.join(`user:${socket.admin.id}`);
    if (socket.admin?.role) {
      socket.join(`role:${socket.admin.role}`);
    }

    socket.on('event-ack', recordAck);
    socket.on('disconnect', () => {});
  });

  setIO(io);
  return io;
}

module.exports = { initSockets, SOCKET_OPTIONS };
