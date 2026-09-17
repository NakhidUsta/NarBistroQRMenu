import { io } from 'socket.io-client'

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:4000'

export const publicSocket = io(SOCKET_URL, {
  withCredentials: true,
  autoConnect: false,
})

export const adminSocket = io(`${SOCKET_URL}/admin`, {
  withCredentials: true,
  autoConnect: false,
})
