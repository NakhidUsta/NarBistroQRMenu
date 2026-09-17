const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { setIO } = require('./emit');

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

function initSockets(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_ORIGIN || 'http://localhost:5174',
      credentials: true,
    },
  });

  // Müştəri (public) namespace — masa QR-i ilə açılan menyu/sifariş-izləmə ekranları
  io.on('connection', (socket) => {
    const table = socket.handshake.query?.table;
    if (table) socket.join(`table:${table}`);

    const orderId = socket.handshake.query?.orderId;
    if (orderId) socket.join(`order:${orderId}`);

    socket.on('join-order', (id) => {
      if (id) socket.join(`order:${id}`);
    });

    socket.on('disconnect', () => {});
  });

  // Admin namespace — JWT cookie ilə doğrulanır, rola görə əlavə room-a qoşulur
  const adminNamespace = io.of('/admin');

  adminNamespace.use((socket, next) => {
    try {
      const token = parseCookie(socket.handshake.headers.cookie, 'qrmenu_token');
      if (!token) return next(new Error('Giriş tələb olunur'));
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      socket.admin = payload;
      next();
    } catch {
      next(new Error('Sessiya etibarsızdır'));
    }
  });

  adminNamespace.on('connection', (socket) => {
    socket.join('admin');
    if (socket.admin?.role) {
      socket.join(`role:${socket.admin.role}`);
    }

    socket.on('disconnect', () => {});
  });

  setIO(io);
  return io;
}

module.exports = { initSockets };
