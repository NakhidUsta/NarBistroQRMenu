import { useT } from '../lib/i18n'

const money = (n) => `${Number(n || 0).toFixed(2)} ₼`

// Hesab bölgüsü — rəqəmlər backend-dən gəlir (quote/order), frontend heç nə hesablamır.
function PriceBreakdown({ data }) {
  const t = useT()
  if (!data) return null
  const rows = [
    Number(data.discount) > 0 && [t('discount'), `−${money(data.discount)}`, 'text-success'],
    Number(data.service_fee) > 0 && [t('service_fee'), money(data.service_fee)],
    Number(data.vat) > 0 && [t('vat'), money(data.vat)],
    Number(data.delivery_fee) > 0 && [t('delivery_fee'), money(data.delivery_fee)],
  ].filter(Boolean)

  return (
    <div className="flex flex-col gap-1.5">
      {rows.length > 0 && (
        <div className="flex justify-between text-[13px] text-muted">
          <span>{t('subtotal')}</span>
          <span>{money(data.subtotal)}</span>
        </div>
      )}
      {rows.map(([label, value, cls]) => (
        <div key={label} className={`flex justify-between text-[13px] ${cls || 'text-muted'}`}>
          <span>{label}</span>
          <span className="font-semibold">{value}</span>
        </div>
      ))}
      <div className="flex justify-between items-center pt-1.5">
        <span className="text-[15px] font-semibold text-ink">{t('total')}</span>
        <span className="font-display text-[20px] font-bold text-burgundy">{money(data.total)}</span>
      </div>
    </div>
  )
}

export default PriceBreakdown
