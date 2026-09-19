import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Bildiriş növləri və hər birinin defolt siqnalı. Notasiya: [tezlik Hz, müddət saniyə]
export const SOUND_TYPES = {
  order_created: { label: 'Yeni sifariş', tone: 'bell' },
  call_waiter: { label: 'Ofisiant çağırılır', tone: 'chime' },
  request_bill: { label: 'Hesab istənilir', tone: 'double' },
  out_of_stock: { label: 'Məhsul bitib', tone: 'low' },
  low_stock: { label: 'Stok azalır', tone: 'low' },
  system_error: { label: 'Sistem xətası', tone: 'alarm' },
}

export const TONES = {
  bell: { label: 'Zəng', notes: [[880, 0.16], [1175, 0.16]] },
  chime: { label: 'Melodiya', notes: [[523, 0.14], [659, 0.14], [784, 0.22]] },
  double: { label: 'İkiqat bip', notes: [[988, 0.1], [0, 0.06], [988, 0.1]] },
  low: { label: 'Yumşaq', notes: [[440, 0.22], [349, 0.26]] },
  alarm: { label: 'Həyəcan', notes: [[1046, 0.12], [784, 0.12], [1046, 0.12], [784, 0.12]] },
  off: { label: 'Səssiz', notes: [] },
}

export const useSoundSettings = create(
  persist(
    (set, get) => ({
      enabled: true, // ümumi açar
      volume: 0.6, // 0–1
      tones: {}, // növ → siqnal adı (verilməyibsə defolt)

      setEnabled: (enabled) => set({ enabled }),
      setVolume: (volume) => set({ volume: Math.min(1, Math.max(0, Number(volume) || 0)) }),
      setTone: (type, tone) => set({ tones: { ...get().tones, [type]: tone } }),
      toneFor: (type) => get().tones[type] || SOUND_TYPES[type]?.tone || 'bell',
    }),
    { name: 'qrmenu_sound', partialize: (s) => ({ enabled: s.enabled, volume: s.volume, tones: s.tones }) },
  ),
)
