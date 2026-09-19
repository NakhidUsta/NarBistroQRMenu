import { useCallback, useEffect, useRef, useState } from 'react'
import { mediaApi, uploadApi, imageVariants, resolveUploadUrl } from '../lib/api'
import { useUiStore } from '../store/uiStore'
import { useVisibleCount } from '../lib/useInfinite'
import LoadMore from '../components/LoadMore'

const ASPECTS = [['1:1', 'Kvadrat 1:1'], ['4:3', 'Klassik 4:3'], ['16:9', 'Geniş 16:9']]
const FOCUS = [['attention', 'Ağıllı (diqqət nöqtəsi)'], ['centre', 'Mərkəz']]
const RATIO_CSS = { '1:1': '1 / 1', '4:3': '4 / 3', '16:9': '16 / 9' }

const fmtSize = (b) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`)
const thumbOf = (m) => resolveUploadUrl(imageVariants(m.url)?.thumb || m.url)

function CropDialog({ media, onClose, onDone }) {
  const showToast = useUiStore((s) => s.showToast)
  const [aspect, setAspect] = useState('1:1')
  const [focus, setFocus] = useState('attention')
  const [busy, setBusy] = useState(false)

  async function submit() {
    setBusy(true)
    try {
      const created = await mediaApi.crop(media.id, aspect, focus)
      showToast('Kəsilmiş şəkil yaradıldı')
      onDone(created)
    } catch (err) {
      showToast(err.response?.data?.error || 'Kəsmə alınmadı')
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-ink/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-panel rounded-2xl p-5 w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Şəkli kəs">
        <h2 className="font-display text-[19px] font-semibold mb-3">Şəkli kəs</h2>
        <div className="w-full rounded-xl overflow-hidden bg-blush mb-3" style={{ aspectRatio: RATIO_CSS[aspect] }}>
          <img src={resolveUploadUrl(media.url)} alt="" className="w-full h-full object-cover" />
        </div>
        <p className="text-[12px] text-muted mb-3">Önizləmə təxmindir; “Ağıllı” rejim serverdə şəklin ən maraqlı hissəsini seçir. Orijinal saxlanılır, kəsilmiş nüsxə yeni şəkil kimi əlavə olunur.</p>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {ASPECTS.map(([v, l]) => (
            <button key={v} type="button" onClick={() => setAspect(v)} className={`px-3 py-1.5 rounded-full text-[12px] font-semibold border ${aspect === v ? 'bg-ink text-cream border-ink' : 'bg-panel text-muted border-border'}`}>{l}</button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5 mb-4">
          {FOCUS.map(([v, l]) => (
            <button key={v} type="button" onClick={() => setFocus(v)} className={`px-3 py-1.5 rounded-full text-[12px] font-semibold border ${focus === v ? 'bg-burgundy text-white border-burgundy' : 'bg-panel text-muted border-border'}`}>{l}</button>
          ))}
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-[13px] font-semibold text-muted">Ləğv et</button>
          <button type="button" onClick={submit} disabled={busy} className="px-4 py-2 rounded-lg text-[13px] font-semibold bg-burgundy text-white disabled:opacity-60">{busy ? 'Kəsilir...' : 'Kəs və yarat'}</button>
        </div>
      </div>
    </div>
  )
}

// Həm səhifə, həm də MediaPicker üçün ortaq yükləmə/siyahı məntiqi
export function useMediaLibrary() {
  const showToast = useUiStore((s) => s.showToast)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)

  const load = useCallback(async () => {
    try {
      setItems(await mediaApi.list())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function upload(files) {
    setUploading(true)
    try {
      for (const file of files) {
        try {
          await uploadApi.upload(file)
        } catch (err) {
          showToast(`${file.name}: ${err.response?.data?.error || 'yüklənmədi'}`)
        }
      }
      await load()
    } finally {
      setUploading(false)
    }
  }

  return { items, loading, uploading, upload, reload: load }
}

function MediaAdmin() {
  const showToast = useUiStore((s) => s.showToast)
  const { items, loading, uploading, upload, reload } = useMediaLibrary()
  const [cropping, setCropping] = useState(null)
  const [drag, setDrag] = useState(false)
  const input = useRef(null)
  const { count, hasMore, more, sentinelRef } = useVisibleCount(items.length, 24, items.length === 0)

  async function remove(m) {
    if (!confirm('Bu şəkil və bütün variantları silinsin?')) return
    try {
      await mediaApi.remove(m.id)
      showToast('Şəkil silindi')
      reload()
    } catch (err) {
      showToast(err.response?.data?.error || 'Silinmədi')
    }
  }

  function onDrop(e) {
    e.preventDefault()
    setDrag(false)
    const files = [...e.dataTransfer.files].filter((f) => f.type.startsWith('image/'))
    if (files.length) upload(files)
  }

  return (
    <div className="max-w-5xl">
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-display text-[24px] font-semibold">Media kitabxanası</h1>
        <button type="button" onClick={() => input.current?.click()} disabled={uploading} className="px-4 py-2 rounded-lg text-[13px] font-semibold bg-burgundy text-white disabled:opacity-60">
          {uploading ? 'Yüklənir...' : '+ Şəkil yüklə'}
        </button>
        <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => { upload([...e.target.files]); e.target.value = '' }} />
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
        className={`rounded-2xl border-2 border-dashed p-4 mb-5 text-center text-[13px] ${drag ? 'border-burgundy bg-blush text-burgundy' : 'border-border text-muted'}`}
      >
        Şəkilləri bura sürüşdürün (JPG, PNG, WEBP, GIF — maks. 5 MB). Hər şəkildən avtomatik WebP/AVIF variantları (kiçik, orta, böyük) yaradılır və EXIF/GPS məlumatı silinir.
      </div>

      {loading ? (
        <p className="text-muted text-[13px]">Yüklənir...</p>
      ) : items.length === 0 ? (
        <p className="text-muted text-[13px] text-center py-10">Hələ şəkil yoxdur.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {items.slice(0, count).map((m) => (
            <div key={m.id} className="bg-panel border border-border/60 rounded-xl overflow-hidden shadow-sm" data-testid="media-card">
              <div className="relative aspect-square bg-blush">
                <img src={thumbOf(m)} alt="" loading="lazy" className="w-full h-full object-cover" />
                {m.in_use && <span className="absolute top-1.5 left-1.5 text-[10px] font-bold uppercase tracking-wide bg-success text-white rounded-full px-2 py-0.5">İstifadədə</span>}
              </div>
              <div className="p-2.5">
                <p className="text-[11.5px] text-muted">{m.width}×{m.height} · {fmtSize(m.size_bytes)}</p>
                <div className="flex gap-1.5 mt-2">
                  <button type="button" onClick={() => setCropping(m)} className="flex-1 text-[12px] font-semibold border border-border rounded-lg py-1.5 hover:bg-blush">Kəs</button>
                  <button type="button" onClick={() => remove(m)} disabled={m.in_use} title={m.in_use ? 'İstifadədə olan şəkil silinə bilməz' : ''} className="flex-1 text-[12px] font-semibold text-danger border border-border rounded-lg py-1.5 hover:bg-blush disabled:opacity-40 disabled:cursor-not-allowed">Sil</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <LoadMore sentinelRef={sentinelRef} hasMore={hasMore} onMore={more} />
      {cropping && <CropDialog media={cropping} onClose={() => setCropping(null)} onDone={() => { setCropping(null); reload() }} />}
    </div>
  )
}

export default MediaAdmin
