import { useEffect, useState } from 'react'
import { adminSocket } from './socket'
import { bindAdminSocket } from './socketBindings'

// Admin/mətbəx ekranları üçün ortaq: socket-i qoşur və bağlantı vəziyyətini qaytarır
// ('connected' | 'reconnecting' | 'disconnected').
export function useAdminSocket() {
  const [status, setStatus] = useState(adminSocket.connected ? 'connected' : 'disconnected')

  useEffect(() => {
    bindAdminSocket()
    const onConnect = () => setStatus('connected')
    const onDisconnect = () => setStatus('disconnected')
    const onAttempt = () => setStatus('reconnecting')
    adminSocket.on('connect', onConnect)
    adminSocket.on('disconnect', onDisconnect)
    adminSocket.io.on('reconnect_attempt', onAttempt)
    if (!adminSocket.connected) adminSocket.connect()
    else setStatus('connected')
    return () => {
      adminSocket.off('connect', onConnect)
      adminSocket.off('disconnect', onDisconnect)
      adminSocket.io.off('reconnect_attempt', onAttempt)
      adminSocket.disconnect()
    }
  }, [])

  return status
}
