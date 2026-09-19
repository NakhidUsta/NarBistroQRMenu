import { create } from 'zustand'
import { useSoundSettings, TONES } from './soundSettings'

// Səsli xəbərdarlıq — WebAudio ilə qısa siqnallar (fayl tələb etmir). Növə görə fərqli siqnal, ümumi səs və ayrıca söndürmə
// istifadəçi ayarlarından (soundSettings) götürülür.
// Brauzerlər AudioContext-i istifadəçi jesti (klik/toxunuş) olmadan "suspended" saxlayır — yəni səhifə yenilənəndən sonra
// admin heç nəyə basmayıbsa səs çıxmaz. Bunu aşkar edib UI-da "Səsi aktivləşdir" düyməsi göstəririk.
let audioCtx = null

// 'running' | 'suspended' | 'unsupported' | 'idle' (hələ context yaradılmayıb)
export const useAudioState = create(() => ({ state: 'idle' }))

const publish = () => useAudioState.setState({ state: audioCtx ? audioCtx.state : 'idle' })

function getContext() {
  if (audioCtx) return audioCtx
  const Ctx = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext)
  if (!Ctx) {
    useAudioState.setState({ state: 'unsupported' })
    return null
  }
  audioCtx = new Ctx()
  audioCtx.onstatechange = publish
  publish()
  return audioCtx
}

// İstifadəçi jestindən sonra çağırılır: context-i açır (suspended → running)
export async function unlockAudio() {
  const ctx = getContext()
  if (!ctx) return false
  try {
    if (ctx.state === 'suspended') await ctx.resume()
  } catch {
    // bəzi brauzerlərdə resume jest tələb edir — növbəti klikdə yenidən cəhd olunacaq
  }
  publish()
  return ctx.state === 'running'
}

let unlockInstalled = false
// Səhifədə ilk klik/toxunuş/düymə basılışında səsi avtomatik aktivləşdirir (admin panel açılanda bir dəfə çağırılır)
export function installAudioUnlock() {
  if (unlockInstalled || typeof window === 'undefined') return
  unlockInstalled = true
  getContext()
  const handler = async () => {
    if (await unlockAudio()) {
      ;['pointerdown', 'keydown', 'touchstart'].forEach((e) => window.removeEventListener(e, handler))
    }
  }
  ;['pointerdown', 'keydown', 'touchstart'].forEach((e) => window.addEventListener(e, handler, { passive: true }))
}

export function playTone(name, volume = 0.6) {
  const notes = TONES[name]?.notes
  if (!notes?.length) return false
  try {
    const ctx = getContext()
    if (!ctx || ctx.state !== 'running') return false
    let t = ctx.currentTime
    notes.forEach(([freq, dur]) => {
      if (freq > 0) {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.value = freq
        const peak = Math.max(0.0001, 0.35 * volume)
        gain.gain.setValueAtTime(0.0001, t)
        gain.gain.exponentialRampToValueAtTime(peak, t + 0.02)
        gain.gain.exponentialRampToValueAtTime(0.0001, t + dur)
        osc.connect(gain).connect(ctx.destination)
        osc.start(t)
        osc.stop(t + dur + 0.02)
      }
      t += dur + 0.04
    })
    return true
  } catch {
    return false // səs mümkün olmadıqda (brauzer məhdudiyyəti) sükutla keç
  }
}

// Bildiriş növünə görə səs. Ayarlarda söndürülübsə və ya növ "Səssiz"dirsə çalmır. Çalındı-çalınmadı nəticəsini qaytarır.
export function playAlert(type = 'order_created') {
  const { enabled, volume, toneFor } = useSoundSettings.getState()
  if (!enabled) return false
  return playTone(toneFor(type), volume)
}

// Ayarlar səhifəsində "sına" düyməsi: ayarlardan asılı olmayaraq (söndürülmüş olsa da) seçilmiş siqnalı çalır
export async function previewTone(name) {
  await unlockAudio()
  return playTone(name, useSoundSettings.getState().volume)
}

export function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission().catch(() => {})
  }
}

export function notificationPermission() {
  return 'Notification' in window ? Notification.permission : 'unsupported'
}

export function browserNotify(title, body) {
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(title, { body })
    } catch {
      // bəzi mühitlərdə konstruktor dəstəklənmir
    }
  }
}
