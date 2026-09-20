# QA hesabatı (işləyərkən doldurulur)

Son yenilənmə: sessiya 1, yoxlama nöqtəsi 4. Ciddilik: Kritik / Yüksək / Orta / Aşağı. Vəziyyət: NAMİZƏD (təsdiq gözləyir) | DÜZƏLDİLDİ | DÜZƏLDİLMƏDİ (qərar lazım).

## Tapıntılar

| # | Ciddilik | Vəziyyət | Harada | Reproduksiya / izah | Düzəliş | Test |
|---|---|---|---|---|---|---|
| F1 | Yüksək (canlıda Kritik) | DÜZƏLDİLDİ (sahibin şifrəni dəyişməsi qalır) | admin hesabı `admin@qrmenu.local` | Real DB-dəki OWNER hesabı ictimai olan defolt `ChangeMe123!` şifrəsindədir (E2E testi onunla daxil olur; server açılışında xəbərdarlıq bunu təsdiqlədi) | `authService`: məlum defolt şifrələrin hash ilə aşkarlanması (`usesDefaultPassword`, 60 san keş, şifrə dəyişəndə silinir); `/api/auth/me` və login cavabında yalnız `default_password` bayrağı; admin paneldə qırmızı xəbərdarlıq bannerı + "Şifrəni dəyiş" linki; server açılışında jurnal xəbərdarlığı. **QA şifrəni dəyişmədi — bunu SAHİB etməlidir** | `backend/tests/defaultPassword.test.js`, `frontend/src/test/adminLayout.test.jsx` |
| F2 | Yüksək | DÜZƏLDİLDİ | `backend/src/app.js`, production cookie `SameSite=None` | Cookie ilə autentifikasiya olunan, gövdəsiz "sadə" POST-lar (`POST /api/orders/:id/refund`, `/api/tables/:id/regenerate`, `/api/auth/logout-all`) başqa saytdan CSRF ilə çağırıla bilirdi (CORS yalnız cavabı gizlədir) | `middleware/csrfGuard.js`: state-dəyişən sorğularda Origin (CLIENT_ORIGIN, PUBLIC_URL, öz host-u) və Sec-Fetch-Site yoxlanılır; provayder callback-i istisnadır | `tests/csrf.test.js` (5 test; düzəlişdən əvvəl 3-ü uğursuz idi). Canlı serverdə və E2E-də təsdiqləndi |
| F3 | Orta | DÜZƏLDİLDİ | `POST /api/tables/:code/call-waiter`, `/request-bill` | Yalnız təxmin edilə bilən masa kodu (`table_001`) lazım idi; QR tokeni yox → kənardan istənilən masaya saxta ofisiant çağırışı/hesab bildirişi yaratmaq olardı | QR tokeni tələb olunur (sabit vaxtlı müqayisə; deaktiv masa 404). Frontend tokeni sessionStorage-də saxlayıb göndərir; 403-də "QR kodu yenidən oxudun" | `backend/tests/qaSecurity.test.js`, `frontend/src/test/tableActions.test.jsx` (düzəlişdən əvvəl uğursuz idi). Canlı: tokensiz və yanlış token 403 |
| F4 | Aşağı | DÜZƏLDİLDİ | `GET /api/tables`, `/:id` | `qr_token`-lər bütün işçi rollarına (KITCHEN daxil) qaytarılırdı; UI-da Masalar səhifəsi KITCHEN-ə bağlıdır, API isə açıq idi | `authorize('OWNER','MANAGER','WAITER')` | `qaSecurity.test.js` |
| F5 | Orta | NAMİZƏD | `backend/src/app.js` | CSP və HSTS başlıqları yoxdur (yalnız nosniff/X-Frame-Options/Referrer-Policy) | Planlaşdırılıb: production-da HSTS; CSP diqqətlə (inline splash, Google Fonts, Unsplash şəkilləri, socket) | — |
| F6 | Aşağı | DÜZƏLDİLDİ | `authService.js` | `jwt.verify` alqoritmi sabitləmirdi | `jwt.verify(..., { algorithms: ['HS256'] })` | `qaSecurity.test.js` (HS512, `none`, yanlış imza, saxta rol, vaxtı keçmiş → 401) |
| F7 | Aşağı | DÜZƏLDİLDİ | `tableService.scanTable` | QR tokeni `!==` ilə müqayisə olunurdu (vaxt fərqi ilə təxmin) | `crypto.timingSafeEqual` | `qaSecurity.test.js` |

## Yoxlanıb, problem YOXDUR (sübutla)
- SEO inyeksiyası: `escapeHtml` + `safeJson` (`<`, `>`, `&` escape) — JSON-LD/meta XSS yoxdur (kod oxundu; dinamik test hələ də edilməlidir).
- Cookie bayraqları: httpOnly, `secure` production-da, refresh cookie yalnız `/api/auth` yoluna (kod oxundu).
- CORS: `origin` sabit (`CLIENT_ORIGIN`), yansıdılmır.
- Admin socket namespace: JWT cookie ilə orta qatda doğrulanır.
- Mail şablonları HTML escape edir; CSV ixracı formula inyeksiyasını neytrallaşdırır (əvvəlki testlərlə).

## Test nəticələri
- Başlanğıc (QA-dan əvvəl): Jest 367, Vitest 204, Playwright 5 keçir (+PWA atlanır).
- Yoxlama nöqtəsi 2: Jest 372 (20 dəst), Playwright 5 keçir.
- Yoxlama nöqtəsi 3: Jest 378 (21 dəst), Vitest 208 (24 fayl).
- Yoxlama nöqtəsi 4: Jest 382 (22 dəst), Vitest 210 (24 fayl).

## Sahibin (istifadəçinin) etməli olduqları — QA-dan
1. **Admin şifrəsini DƏRHAL dəyişin** (Admin → Hesabım → Şifrəni dəyiş). Hazırkı şifrə defoltdur və README/testlərdə yazılıb.
