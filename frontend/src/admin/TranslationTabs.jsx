import { useState } from 'react'

const TABS = [
  { code: '', label: 'AZ' },
  { code: '_en', label: 'EN' },
  { code: '_ru', label: 'RU' },
]

// fields: [{ key: 'name', label: 'Ad', type: 'text' | 'textarea' }]
// AZ (code='') sahələr `key`-ə, EN/RU isə `key_en`/`key_ru`-ya yazılır.
function TranslationTabs({ fields, form, setForm }) {
  const [tab, setTab] = useState('')

  return (
    <div className="border border-border rounded-xl p-3 bg-cream/50">
      <div className="flex gap-1 mb-3">
        {TABS.map((tb) => (
          <button
            key={tb.code}
            type="button"
            onClick={() => setTab(tb.code)}
            className={`px-3 py-1 rounded-full text-[11.5px] font-bold ${
              tab === tb.code ? 'bg-ink text-cream' : 'bg-panel text-muted border border-border'
            }`}
          >
            {tb.label}
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-2.5">
        {fields.map((f) => {
          const fieldKey = `${f.key}${tab}`
          return (
            <div key={fieldKey}>
              <label className="text-[11.5px] font-semibold text-muted mb-1 block">
                {f.label}{tab && ` (${TABS.find((t) => t.code === tab).label})`}
              </label>
              {f.type === 'textarea' ? (
                <textarea
                  rows={2}
                  required={tab === '' && f.required}
                  value={form[fieldKey] || ''}
                  onChange={(e) => setForm({ ...form, [fieldKey]: e.target.value })}
                  className="w-full bg-panel border border-border rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-burgundy/30"
                />
              ) : (
                <input
                  required={tab === '' && f.required}
                  value={form[fieldKey] || ''}
                  onChange={(e) => setForm({ ...form, [fieldKey]: e.target.value })}
                  className="w-full bg-panel border border-border rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-burgundy/30"
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default TranslationTabs
