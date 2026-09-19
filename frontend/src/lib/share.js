// Paylaşım: mobil brauzerlərdə sistem paylaşım pəncərəsi (Instagram, WhatsApp, Telegram... orada seçilir);
// dəstəkləmirsə linki mübadilə buferinə kopyalayır. Instagram-ın veb "share intent"-i olmadığı üçün əsl yol budur.
// Nəticə: 'shared' | 'copied' | 'cancelled' | 'failed'
export async function shareLink({ title, text, url }) {
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({ title, text, url })
      return 'shared'
    } catch (err) {
      if (err?.name === 'AbortError') return 'cancelled'
      // başqa xəta olarsa kopyalama ehtiyatına keçirik
    }
  }
  try {
    await navigator.clipboard.writeText(url)
    return 'copied'
  } catch {
    return 'failed'
  }
}

// Masa kodunu (?table=) paylaşılan linkə ötürmürük — link masasız ümumi menyu linkidir.
export function publicUrl(path) {
  return `${window.location.origin}${path}`
}
