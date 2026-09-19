import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { tablesApi } from '../lib/api'
import { useUiStore } from '../store/uiStore'
import Button from '../components/Button'

function tableLink(table) {
  return `${window.location.origin}/menyu?table=${table.code}&t=${table.qr_token}`
}

function QrCard({ table }) {
  const [dataUrl, setDataUrl] = useState('')

  useEffect(() => {
    QRCode.toDataURL(tableLink(table), { width: 240, margin: 1, color: { dark: '#201a16', light: '#fffdfa' } }).then(setDataUrl)
  }, [table.qr_token])

  function download() {
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = `${table.code}.png`
    a.click()
  }

  function copyLink() {
    navigator.clipboard.writeText(tableLink(table))
  }

  return (
    <div className="bg-panel rounded-2xl border border-border/60 p-5 flex flex-col items-center text-center">
      <p className="font-display text-[16px] font-semibold mb-0.5">{table.label}</p>
      <p className="text-[11px] text-muted mb-3">{table.code} · {table.scan_count} skan</p>
      {dataUrl && <img src={dataUrl} alt="QR" className="w-40 h-40 rounded-xl border border-border mb-3" />}
      <div className="flex gap-2 w-full">
        <button onClick={copyLink} className="flex-1 text-[12px] font-semibold border border-border rounded-lg py-2 hover:bg-blush">Linki kopyala</button>
        <button onClick={download} className="flex-1 text-[12px] font-semibold border border-border rounded-lg py-2 hover:bg-blush">PNG yüklə</button>
      </div>
    </div>
  )
}

function TablesAdmin() {
  const [tables, setTables] = useState([])
  const [label, setLabel] = useState('')
  const [capacity, setCapacity] = useState(2)
  const [creating, setCreating] = useState(false)
  const showToast = useUiStore((s) => s.showToast)

  async function load() {
    setTables(await tablesApi.list())
  }

  useEffect(() => {
    load()
  }, [])

  async function handleCreate(e) {
    e.preventDefault()
    setCreating(true)
    try {
      await tablesApi.create({ label, capacity })
      setLabel('')
      setCapacity(2)
      showToast('Masa yaradıldı')
      load()
    } catch (err) {
      showToast(err.response?.data?.error || 'Xəta baş verdi', 'error')
    } finally {
      setCreating(false)
    }
  }

  async function handleRegenerate(id) {
    if (!confirm('QR kodu yeniləmək köhnə çap edilmiş QR-ı işləməz edəcək. Davam edilsin?')) return
    await tablesApi.regenerate(id)
    showToast('QR kod yeniləndi')
    load()
  }

  async function toggleActive(table) {
    await tablesApi.update(table.id, { label: table.label, capacity: table.capacity, is_active: !table.is_active })
    load()
  }

  async function handleDelete(id) {
    if (!confirm('Bu masanı silmək istədiyinizə əminsiniz?')) return
    await tablesApi.remove(id)
    load()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="font-display text-[24px] font-semibold">Masalar / QR kodlar</h1>
      </div>

      <form onSubmit={handleCreate} className="bg-panel rounded-2xl border border-border/60 p-4 flex flex-wrap items-end gap-3 mb-6">
        <div>
          <label className="text-[12px] font-semibold text-muted mb-1 block">Masa adı</label>
          <input required value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Masa 4"
            className="bg-cream border border-border rounded-lg px-3 py-2.5 text-[13.5px] focus:outline-none focus:ring-2 focus:ring-burgundy/30" />
        </div>
        <div>
          <label className="text-[12px] font-semibold text-muted mb-1 block">Tutum</label>
          <input type="number" min="1" value={capacity} onChange={(e) => setCapacity(Number(e.target.value))}
            className="w-20 bg-cream border border-border rounded-lg px-3 py-2.5 text-[13.5px] focus:outline-none focus:ring-2 focus:ring-burgundy/30" />
        </div>
        <Button type="submit" disabled={creating}>{creating ? 'Yaradılır...' : '+ Masa əlavə et'}</Button>
      </form>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {tables.map((table) => (
          <div key={table.id} className="flex flex-col gap-2">
            <QrCard table={table} />
            <div className="flex gap-2 justify-center text-[12px] font-semibold">
              <button onClick={() => toggleActive(table)} className={table.is_active ? 'text-success' : 'text-danger'}>
                {table.is_active ? 'Aktiv' : 'Deaktiv'}
              </button>
              <span className="text-border">·</span>
              <button onClick={() => handleRegenerate(table.id)} className="text-burgundy">Yenilə (regenerate)</button>
              <span className="text-border">·</span>
              <button onClick={() => handleDelete(table.id)} className="text-danger">Sil</button>
            </div>
          </div>
        ))}
      </div>
      {tables.length === 0 && <p className="text-muted text-[13.5px]">Hələ masa yoxdur</p>}
    </div>
  )
}

export default TablesAdmin
