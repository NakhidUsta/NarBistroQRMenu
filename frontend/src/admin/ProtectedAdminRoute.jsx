import { useEffect } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

function ProtectedAdminRoute() {
  const admin = useAuthStore((s) => s.admin)
  const status = useAuthStore((s) => s.status)
  const fetchMe = useAuthStore((s) => s.fetchMe)

  useEffect(() => {
    if (status === 'idle') fetchMe()
  }, [status])

  if (status === 'idle' || status === 'loading') {
    return <div className="min-h-screen flex items-center justify-center bg-ink text-cream">Yüklənir...</div>
  }
  if (!admin) {
    return <Navigate to="/admin/login" replace />
  }
  return <Outlet />
}

export default ProtectedAdminRoute
