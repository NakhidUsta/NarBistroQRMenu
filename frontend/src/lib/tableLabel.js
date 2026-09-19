// Masanın göstərilən adı. Etiket artıq "Masa 1" kimi "Masa" sözü ilə başlayırsa təkrar yazılmır ("MASA — MASA 1" əvəzinə "Masa 1").
export function tableText(t, table) {
  if (!table) return ''
  const word = t('table_label')
  const label = String(table.label || '').trim()
  return label.toLowerCase().startsWith(word.toLowerCase()) ? label : `${word} — ${label}`
}
