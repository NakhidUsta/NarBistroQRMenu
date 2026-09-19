import { useEffect, useState } from 'react'
import { allergensApi } from '../lib/api'

// Standart allergen kataloqundan seçim (AB-nin 14 allergeni). Seçilənlər müştəri tərəfdə ikon+ad kimi göstərilir və filtrdə işlənir.
function AllergenPicker({ value = [], onChange }) {
  const [catalog, setCatalog] = useState([])

  useEffect(() => {
    allergensApi.list().then(setCatalog).catch(() => setCatalog([]))
  }, [])

  function toggle(id) {
    onChange(value.includes(id) ? value.filter((i) => i !== id) : [...value, id])
  }

  return (
    <div>
      <label className="text-[12.5px] font-semibold text-muted mb-1 block">Allergenlər (kataloqdan)</label>
      <div className="flex flex-wrap gap-1.5">
        {catalog.map((a) => (
          <button
            key={a.id}
            type="button"
            aria-pressed={value.includes(a.id)}
            onClick={() => toggle(a.id)}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[12px] font-semibold border ${value.includes(a.id) ? 'bg-burgundy text-white border-burgundy' : 'bg-cream text-ink border-border'}`}
          >
            <span aria-hidden="true">{a.icon}</span>
            {a.name}
          </button>
        ))}
      </div>
    </div>
  )
}

export default AllergenPicker
