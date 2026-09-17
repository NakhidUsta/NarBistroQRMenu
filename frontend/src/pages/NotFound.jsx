import Button from '../components/Button'

function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-5 text-center bg-cream">
      <p className="font-display text-5xl font-bold text-burgundy mb-2">404</p>
      <p className="text-muted mb-6">Axtardığınız səhifə tapılmadı</p>
      <Button to="/menyu">Menyuya qayıt</Button>
    </div>
  )
}

export default NotFound
