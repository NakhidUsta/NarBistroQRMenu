import { useState } from 'react'
import { uploadApi, imageVariants, resolveUploadUrl } from '../lib/api'
import MediaPicker from './MediaPicker'

function ImageUploadField({ value, onChange, label = 'Şəkil' }) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [picking, setPicking] = useState(false)

  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError('')
    try {
      const { url } = await uploadApi.upload(file)
      onChange(url)
    } catch (err) {
      setError(err.response?.data?.error || 'Şəkil yüklənərkən xəta baş verdi')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div>
      <label className="text-[12.5px] font-semibold text-muted mb-1 block">{label}</label>
      <div className="flex flex-wrap items-center gap-3">
        {value && (
          <img src={resolveUploadUrl(imageVariants(value)?.thumb || value)} alt="" className="w-16 h-16 rounded-lg object-cover border border-border" />
        )}
        <label className="cursor-pointer text-[13px] font-semibold text-burgundy border border-border rounded-lg px-3 py-2 hover:bg-blush">
          {uploading ? 'Yüklənir...' : 'Şəkil seç'}
          <input type="file" accept="image/*" className="hidden" onChange={handleFile} disabled={uploading} />
        </label>
        <button type="button" onClick={() => setPicking(true)} className="text-[13px] font-semibold text-muted border border-border rounded-lg px-3 py-2 hover:bg-blush">
          Kitabxanadan seç
        </button>
      </div>
      {picking && <MediaPicker current={value} onPick={(url) => { onChange(url); setPicking(false) }} onClose={() => setPicking(false)} />}
      {error && <p className="text-[12px] text-danger mt-1">{error}</p>}
    </div>
  )
}

export default ImageUploadField
