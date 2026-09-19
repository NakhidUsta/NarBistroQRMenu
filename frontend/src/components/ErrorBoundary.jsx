import { Component } from 'react'

// Gözlənilməz render xətası və ya lazy səhifənin (chunk) yüklənməməsi (oflayn / yeni versiya çıxandan sonra köhnə fayl adı)
// boş ağ ekranla nəticələnməsin: aydın mesaj + "Yenidən cəhd et" və "Səhifəni yenilə" düymələri göstərilir.
class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error) {
    console.error('Səhifə xətası:', error)
  }

  isChunkError() {
    return /Loading chunk|dynamically imported module|Failed to fetch dynamically|Importing a module script failed/i.test(this.state.error?.message || '')
  }

  render() {
    if (!this.state.error) return this.props.children
    const chunk = this.isChunkError()
    return (
      <div role="alert" className="min-h-[60vh] flex flex-col items-center justify-center px-6 text-center bg-cream">
        <p className="font-display text-[22px] font-semibold text-ink mb-1">{chunk ? 'Səhifə yüklənmədi' : 'Xəta baş verdi'}</p>
        <p className="text-[13.5px] text-muted mb-5 max-w-sm">
          {chunk ? 'İnternet bağlantısını yoxlayın — bərpa olunanda yenidən cəhd edə bilərsiniz.' : 'Gözlənilməz xəta oldu. Yenidən cəhd edin, davam edərsə səhifəni yeniləyin.'}
        </p>
        <div className="flex gap-2">
          <button type="button" onClick={() => this.setState({ error: null })} className="bg-btn text-cream rounded-full px-5 py-2.5 text-[13.5px] font-semibold">
            Yenidən cəhd et
          </button>
          <button type="button" onClick={() => window.location.reload()} className="border border-border rounded-full px-5 py-2.5 text-[13.5px] font-semibold text-ink">
            Səhifəni yenilə
          </button>
        </div>
      </div>
    )
  }
}

export default ErrorBoundary
