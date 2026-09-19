// E-poçt şablonları (Azərbaycan dilində). Dəyişənlər HTML-də escape olunur; link yalnız konfiqurasiyadan (PUBLIC_URL) qurulur.
const escapeHtml = (v) =>
  String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

function layout({ title, intro, buttonLabel, link, outro, restaurant }) {
  const brand = escapeHtml(restaurant);
  return `<!doctype html>
<html lang="az"><body style="margin:0;background:#f7f0e6;font-family:Arial,Helvetica,sans-serif;color:#201a16">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
    <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;padding:32px">
      <tr><td style="font-size:20px;font-weight:bold;color:#5c1a2e;padding-bottom:16px">${brand}</td></tr>
      <tr><td style="font-size:18px;font-weight:bold;padding-bottom:12px">${escapeHtml(title)}</td></tr>
      <tr><td style="font-size:14px;line-height:1.6;padding-bottom:24px">${escapeHtml(intro)}</td></tr>
      <tr><td style="padding-bottom:24px"><a href="${escapeHtml(link)}" style="background:#5c1a2e;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:999px;font-size:14px;font-weight:bold;display:inline-block">${escapeHtml(buttonLabel)}</a></td></tr>
      <tr><td style="font-size:12px;line-height:1.6;color:#6b5f56">Düymə işləmirsə bu linki brauzerə yapışdırın:<br><span style="word-break:break-all">${escapeHtml(link)}</span></td></tr>
      <tr><td style="font-size:12px;line-height:1.6;color:#6b5f56;padding-top:16px">${escapeHtml(outro)}</td></tr>
    </table>
  </td></tr></table>
</body></html>`;
}

function passwordReset({ link, restaurant, minutes }) {
  const intro = `Hesabınız üçün şifrə sıfırlama tələb olundu. Yeni şifrə təyin etmək üçün aşağıdakı düyməyə basın. Link ${minutes} dəqiqə ərzində və yalnız bir dəfə işləyir.`;
  const outro = 'Bu tələbi siz göndərməmisinizsə, bu məktubu nəzərə almayın — şifrəniz dəyişməyəcək.';
  return {
    subject: `${restaurant} — şifrənin sıfırlanması`,
    text: `${intro}\n\n${link}\n\n${outro}`,
    html: layout({ title: 'Şifrənin sıfırlanması', intro, buttonLabel: 'Yeni şifrə təyin et', link, outro, restaurant }),
  };
}

function emailVerification({ link, restaurant, hours }) {
  const intro = `E-poçt ünvanınızı təsdiqləmək üçün aşağıdakı düyməyə basın. Link ${hours} saat ərzində və yalnız bir dəfə işləyir.`;
  const outro = 'Bu tələbi siz göndərməmisinizsə, məktubu nəzərə almayın.';
  return {
    subject: `${restaurant} — e-poçtun təsdiqi`,
    text: `${intro}\n\n${link}\n\n${outro}`,
    html: layout({ title: 'E-poçtun təsdiqi', intro, buttonLabel: 'E-poçtu təsdiqlə', link, outro, restaurant }),
  };
}

function testMail({ restaurant }) {
  const text = `Bu, ${restaurant} admin panelindən göndərilən sınaq məktubudur. Bunu oxuyursunuzsa, e-poçt (SMTP) ayarları düzgündür — şifrə sıfırlama və təsdiq məktubları işləyəcək.`;
  return {
    subject: `${restaurant} — sınaq məktubu`,
    text,
    html: `<p style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6">${escapeHtml(text)}</p>`,
  };
}

module.exports = { passwordReset, emailVerification, testMail, escapeHtml };
