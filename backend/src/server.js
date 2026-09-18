const http = require('http');
const app = require('./app');
const { initSockets } = require('./sockets');

const server = http.createServer(app);
initSockets(server);

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`QR Menu backend http://localhost:${PORT} ünvanında işləyir`);
});
