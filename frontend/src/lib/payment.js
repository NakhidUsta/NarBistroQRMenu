// Ödəniş üsulları və statusları (admin paneldə göstəriş; müştəri mətnləri i18n-dədir)
export const METHOD_LABELS = { CASH: 'Nağd', CARD_POS: 'Kartla (masada)', ONLINE: 'Onlayn kart' }

export const PAY_STATUS = {
  UNPAID: { label: 'Ödənilməyib', cls: 'bg-blush text-muted' },
  PENDING: { label: 'Ödəniş gözlənilir', cls: 'bg-gold/25 text-ink' },
  PAID: { label: 'Ödənilib', cls: 'bg-success/15 text-success' },
  FAILED: { label: 'Ödəniş alınmadı', cls: 'bg-danger/10 text-danger' },
  REFUNDED: { label: 'Geri qaytarılıb', cls: 'bg-blush text-danger' },
}

// Onlayn ödənişi təsdiqlənməyib: sifariş mətbəxə çatmır, işçi yalnız ləğv edə bilər
export const awaitingOnlinePayment = (order) =>
  order?.payment_method === 'ONLINE' && ['PENDING', 'FAILED'].includes(order?.payment_status)

// Restoran ayarlarına görə müştəriyə təklif olunan üsullar (ən azı NAĞD həmişə var)
export function enabledMethods(restaurant) {
  const list = []
  if (restaurant?.pay_cash !== false) list.push('CASH')
  if (restaurant?.pay_card_pos !== false) list.push('CARD_POS')
  if (restaurant?.pay_online && restaurant?.online_payment_available) list.push('ONLINE')
  return list.length ? list : ['CASH']
}
