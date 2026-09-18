let audioCtx

// Yeni sifariş/çağırış səsli xəbərdarlığı — WebAudio ilə qısa iki tonlu siqnal (fayl tələb etmir).
export function playAlert() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)()
    const now = audioCtx.currentTime
    ;[880, 1175].forEach((freq, i) => {
      const osc = audioCtx.createOscillator()
      const gain = audioCtx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.0001, now + i * 0.18)
      gain.gain.exponentialRampToValueAtTime(0.25, now + i * 0.18 + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.18 + 0.16)
      osc.connect(gain).connect(audioCtx.destination)
      osc.start(now + i * 0.18)
      osc.stop(now + i * 0.18 + 0.18)
    })
  } catch {
    // səs mümkün olmadıqda (brauzer məhdudiyyəti) sükutla keç
  }
}

export function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission().catch(() => {})
  }
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
