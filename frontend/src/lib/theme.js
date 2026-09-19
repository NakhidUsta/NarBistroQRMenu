export const FONT_OPTIONS = ['Fraunces', 'Playfair Display', 'Cormorant Garamond', 'DM Serif Display', 'Inter']

export const DEFAULT_THEME = {
  primary: '#5c1a2e',
  background: '#f7f0e6',
  button: '#201a16',
  font: 'Fraunces',
}

export function parseTheme(raw) {
  if (!raw) return {}
  try {
    const t = typeof raw === 'string' ? JSON.parse(raw) : raw
    return t && typeof t === 'object' ? t : {}
  } catch {
    return {}
  }
}

function shade(hex, factor) {
  const n = parseInt(hex.slice(1), 16)
  const ch = (v) => Math.max(0, Math.min(255, Math.round(v * factor)))
  const r = ch((n >> 16) & 255)
  const g = ch((n >> 8) & 255)
  const b = ch(n & 255)
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`
}

let fontLink

function loadFont(font) {
  if (!font || font === 'Inter' || font === 'Fraunces') return
  const href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(font).replace(/%20/g, '+')}:wght@400;500;600;700&display=swap`
  if (!fontLink) {
    fontLink = document.createElement('link')
    fontLink.rel = 'stylesheet'
    document.head.appendChild(fontLink)
  }
  if (fontLink.href !== href) fontLink.href = href
}

export function resetTheme() {
  const root = document.documentElement.style
  ;['--color-burgundy', '--color-burgundy-light', '--color-burgundy-dark', '--color-cream', '--color-btn', '--font-display']
    .forEach((p) => root.removeProperty(p))
}

// Admin-idarəli temanı CSS dəyişənləri kimi tətbiq edir; Tailwind utility-ləri bu dəyişənlərdən oxuyur.
export function applyTheme(rawTheme) {
  const t = { ...DEFAULT_THEME, ...parseTheme(rawTheme) }
  const root = document.documentElement.style
  root.setProperty('--color-burgundy', t.primary)
  root.setProperty('--color-burgundy-light', shade(t.primary, 1.25))
  root.setProperty('--color-burgundy-dark', shade(t.primary, 0.65))
  root.setProperty('--color-cream', t.background)
  root.setProperty('--color-btn', t.button)
  loadFont(t.font)
  root.setProperty('--font-display', `"${t.font}", serif`)
}

// Restoran favicon-u (admin paneldən). Təyin olunmayıbsa index.html-dəki standart ikon saxlanılır.
const DEFAULT_ICON = '/favicon.svg'

export function applyFavicon(url) {
  if (typeof document === 'undefined') return
  let link = document.querySelector('link[rel="icon"]')
  if (!link) {
    link = document.createElement('link')
    link.rel = 'icon'
    document.head.appendChild(link)
  }
  if (!url) {
    link.type = 'image/svg+xml'
    link.href = DEFAULT_ICON
    return
  }
  const ext = url.split('?')[0].split('.').pop().toLowerCase()
  link.type = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', svg: 'image/svg+xml', ico: 'image/x-icon' }[ext] || ''
  link.href = url
}
