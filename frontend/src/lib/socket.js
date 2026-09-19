import { io } from 'socket.io-client'

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:4000'

// Yenidən qoşulma: eksponensial geri çəkilmə (1s → 2s → 4s … maks. 30s) + təsadüfi yayınma (jitter), sonsuz cəhd.
// Heartbeat (ping/pong) serverlə razılaşdırılıb (bax: backend/src/sockets/index.js). Bağlantı vəziyyəti üçün
// 'connect' / 'disconnect' / io 'reconnect_attempt' hadisələri istifadə olunur (bax: useAdminSocket).
export const RECONNECT_OPTIONS = {
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 30000,
  randomizationFactor: 0.5,
  timeout: 10000,
}

export const publicSocket = io(SOCKET_URL, {
  withCredentials: true,
  autoConnect: false,
  ...RECONNECT_OPTIONS,
})

export const adminSocket = io(`${SOCKET_URL}/admin`, {
  withCredentials: true,
  autoConnect: false,
  ...RECONNECT_OPTIONS,
})

// Sifariş izləmə otağı: backend yalnız sifarişin gizli tokenini bilənləri qəbul edir. Otaq üzvlüyü bağlantı
// kəsiləndə itə bilər (qısa kəsilmələr istisna) — ona görə hər (yenidən) qoşulmada avtomatik təkrar tələb olunur.
const joinedOrders = new Map() // id → token

function requestJoin(id, token) {
  publicSocket.emit('join-order', { id: Number(id), token }, () => {})
}

export function joinOrder(id, token) {
  if (!id || !token) return
  joinedOrders.set(String(id), token)
  if (publicSocket.connected) requestJoin(id, token)
}

publicSocket.on('connect', () => {
  joinedOrders.forEach((token, id) => requestJoin(id, token))
})
