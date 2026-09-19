import { useState } from 'react'
import { uploadApi, imageVariants, resolveUploadUrl } from '../lib/api'
import MediaPicker from './MediaPicker'

const MAX_IMAGES = 10

// Məhsulun şəkil qalereyası: yüklə / kitabxanadan seç / sırala / sil. Birinci şəkil əsas şəkildir (menyu kartında görünən).
function ImageGalleryField({ value = [], onChange, label = 'Şəkillər' }) {
  const [uploading, setUploading] = useState(false)
  const [picking, setPicking] = useState(false)
  const [error, setError] = useState('')
  const full = value.length >= MAX_IMAGES

  function add(url) {
    if (!url || value.includes(url)) return
    onChange([...value, url])
  }

  async function handleFiles(e) {
    const files = [...(e.target.files || [])].slice(0, MAX_IMAGES - value.length)
    e.target.value = ''
    if (!files.length) return
    setUploading(true)
    setError('')
    try {
      const uploaded = []
      for (const file of files) {
        const { url } = await uploadApi.upload(file)
        uploaded.push(url)
      }
      onChange([...value, ...uploaded.filter((u) => !value.includes(u))])
    } catch (err) {
      setError(err.response?.data?.error || 'Şəkil yüklənərkən xəta baş verdi')
    } finally {
      setUploading(false)
    }
  }

  function move(index, delta) {
    const next = [...value]
    const target = index + delta
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
  }

  return (
    <div>
      <label className="text-[12.5px] font-semibold text-muted mb-1 block">{label} <span className="font-normal">({value.length}/{MAX_IMAGES})</span></label>
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-2.5 mb-2.5" data-testid="gallery-list">
          {value.map((url, i) => (
            <li key={url} className="relative w-20">
              <img src={resolveUploadUrl(imageVariants(url)?.thumb || url)} alt="" className="w-20 h-20 rounded-lg object-cover border border-border bg-blush" />
              {i === 0 && <span className="absolute top-1 left-1 text-[9.5px] font-bold uppercase bg-gold text-ink rounded-full px-1.5 py-0.5">Əsas</span>}
              <div className="flex justify-between mt-1">
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Sola" className="w-6 h-6 rounded-md border border-border text-[12px] disabled:opacity-30">←</button>
                <button type="button" onClick={() => onChange(value.filter((u) => u !== url))} aria-label="Sil" className="w-6 h-6 rounded-md border border-border text-[12px] text-danger">×</button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === value.length - 1} aria-label="Sağa" className="w-6 h-6 rounded-md border border-border text-[12px] disabled:opacity-30">→</button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <label className={`text-[13px] font-semibold text-burgundy border border-border rounded-lg px-3 py-2 ${full || uploading ? 'opacity-50' : 'cursor-pointer hover:bg-blush'}`}>
          {uploading ? 'Yüklənir...' : 'Şəkil yüklə'}
          <input type="file" accept="image/*" multiple className="hidden" onChange={handleFiles} disabled={full || uploading} />
        </label>
        <button type="button" onClick={() => setPicking(true)} disabled={full} className="text-[13px] font-semibold text-muted border border-border rounded-lg px-3 py-2 hover:bg-blush disabled:opacity-50">
          Kitabxanadan seç
        </button>
      </div>
      {picking && <MediaPicker onPick={(url) => { add(url); setPicking(false) }} onClose={() => setPicking(false)} />}
      {error && <p className="text-[12px] text-danger mt-1">{error}</p>}
    </div>
  )
}

export default ImageGalleryField
