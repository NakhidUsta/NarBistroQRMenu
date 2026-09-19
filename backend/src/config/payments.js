// Ödəniş konfiqurasiyası (.env). Açarlar yalnız serverdə saxlanılır, heç vaxt frontend-ə göndərilmir.
//   PAYMENT_PROVIDER = epoint | test | (boş → onlayn ödəniş söndürülüb)
//   EPOINT_PUBLIC_KEY / EPOINT_PRIVATE_KEY  — epoint.az merchant panelindən
//   PUBLIC_URL      — saytın açıq ünvanı (müştəri ödənişdən sonra bura qayıdır), məs. https://menu.example.az
//   API_PUBLIC_URL  — provayderin server-server bildirişi (callback) göndərdiyi ünvan; defolt PUBLIC_URL
//   PAYMENT_HOLD_MINUTES — ödənilməyən onlayn sifarişin saxlanma müddəti (defolt 30 dəq), sonra ləğv edilir və stok qaytarılır
function read() {
  const provider = String(process.env.PAYMENT_PROVIDER || '').trim().toLowerCase();
  const publicUrl = (process.env.PUBLIC_URL || process.env.CLIENT_ORIGIN || 'http://localhost:5174').replace(/\/+$/, '');
  return {
    provider,
    publicUrl,
    apiPublicUrl: (process.env.API_PUBLIC_URL || process.env.PUBLIC_URL || `http://localhost:${process.env.PORT || 4000}`).replace(/\/+$/, ''),
    holdMinutes: Number(process.env.PAYMENT_HOLD_MINUTES) || 30,
    epoint: {
      publicKey: process.env.EPOINT_PUBLIC_KEY || '',
      privateKey: process.env.EPOINT_PRIVATE_KEY || '',
      apiBase: (process.env.EPOINT_API_BASE || 'https://epoint.az/api/1').replace(/\/+$/, ''),
      sendResultUrl: process.env.EPOINT_SEND_RESULT_URL === '1',
    },
  };
}

module.exports = { get: read };
