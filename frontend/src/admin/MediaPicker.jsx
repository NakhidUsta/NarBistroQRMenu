import { imageVariants, resolveUploadUrl } from '../lib/api'
import { useMediaLibrary } from './MediaAdmin'

// Şəkil sahəsi üçün "kitabxanadan seç" pəncərəsi — seçilən şəkil məhsulun əsas şəkli olur.
function MediaPicker({ current, onPick, onClose }) {
  const { items, loading } = useMediaLibrary()

  return (
    <div className="fixed inset-0 z-50 bg-ink/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-panel rounded-2xl p-5 w-full max-w-2xl max-h-[85vh] flex flex-col shadow-xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Kitabxanadan şəkil seç">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-[19px] font-semibold">Kitabxanadan seç</h2>
          <button type="button" onClick={onClose} className="text-muted text-[20px] leading-none px-2" aria-label="Bağla">×</button>
        </div>
        <div className="overflow-y-auto">
          {loading ? (
            <p className="text-muted text-[13px]">Yüklənir...</p>
          ) : items.length === 0 ? (
            <p className="text-muted text-[13px] text-center py-8">Kitabxana boşdur. Əvvəlcə “Şəkil seç” ilə yükləyin.</p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
              {items.map((m) => (
                <button key={m.id} type="button" onClick={() => onPick(m.url)} className={`relative aspect-square rounded-lg overflow-hidden border-2 ${current === m.url ? 'border-burgundy' : 'border-transparent hover:border-gold'}`}>
                  <img src={resolveUploadUrl(imageVariants(m.url)?.thumb || m.url)} alt="" loading="lazy" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default MediaPicker
