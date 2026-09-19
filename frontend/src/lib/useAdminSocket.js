import { useEffect, useState } from 'react'
import { adminSocket } from './socket'
import { bindAdminSocket } from './socketBindings'
import { refreshSession } from './api'

// Access token 15 dəqiqəlikdir — panel açıq olduqca 10 dəqiqədən bir səssiz yenilənir (refresh token rotasiya olunur).
// Kompüter yuxudan/oflayndan qayıdanda (tab görünən olanda) da dərhal yenilənir ki, socket və sorğular 401 almasın.
export const KEEPALIVE_MS = 10 * 60 * 1000

// Admin/mətbəx ekranları üçün ortaq: socket-i qoşur, sessiyanı canlı saxlayır və bağlantı vəziyyətini qaytarır
// ('connected' | 'reconnecting' | 'disconnected').
export function useAdminSocket() {
  const [status, setStatus] = useState(adminSocket.connected ? 'connected' : 'disconnected')

  useEffect(() => {
    bindAdminSocket()
    const onConnect = () => setStatus('connected')
    const onDisconnect = () => setStatus('disconnected')
    const onAttempt = () => setStatus('reconnecting')

    // Orta qat (JWT) rədd edibsə socket.io avtomatik yenidən qoşulmur — sessiyanı yeniləyib əl ilə qoşuruq.
    const onConnectError = async (err) => {
      if (/etibarsız|bağlanıb|Giriş tələb/i.test(err?.message || '')) {
        try {
          await refreshSession()
          adminSocket.connect()
        } catch {
          setStatus('disconnected') // refresh də bitib — HTTP sorğuları giriş səhifəsinə yönləndirəcək
        }
      }
    }
    const keepAlive = () => refreshSession().catch(() => {})
    const onVisible = () => {
      if (document.visibilityState === 'visible') keepAlive()
    }

    adminSocket.on('connect', onConnect)
    adminSocket.on('disconnect', onDisconnect)
    adminSocket.on('connect_error', onConnectError)
    adminSocket.io.on('reconnect_attempt', onAttempt)
    const timer = setInterval(keepAlive, KEEPALIVE_MS)
    document.addEventListener('visibilitychange', onVisible)

    if (!adminSocket.connected) adminSocket.connect()
    else setStatus('connected')
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      adminSocket.off('connect', onConnect)
      adminSocket.off('disconnect', onDisconnect)
      adminSocket.off('connect_error', onConnectError)
      adminSocket.io.off('reconnect_attempt', onAttempt)
      adminSocket.disconnect()
    }
  }, [])

  return status
}
