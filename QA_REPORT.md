# QA hesabatı (işləyərkən doldurulur)

Son yenilənmə: sessiya 1. Ciddilik: Kritik / Yüksək / Orta / Aşağı. Vəziyyət: TƏSDİQ GÖZLƏYİR (namizəd) | TƏSDİQLƏNDİ | DÜZƏLDİLDİ | DÜZƏLDİLMƏDİ (qərar lazım).

## Tapıntılar

| # | Ciddilik | Vəziyyət | Harada | Reproduksiya / izah | Düzəliş | Test |
|---|---|---|---|---|---|---|
| F1 | Yüksək (canlıda Kritik) | TƏSDİQ GÖZLƏYİR | admin hesabı `admin@qrmenu.local` | E2E testi defolt `ChangeMe123!` şifrəsi ilə real DB-də girir → real OWNER hesabının şifrəsi ictimai olan defoltdur (README/E2E-də yazılıb) | Planlaşdırılıb: defolt şifrə ilə girişdə panel bannerı + server açılışında xəbərdarlıq (şifrəni SƏN dəyiş; QA onu dəyişmir) | — |
| F2 | Yüksək | TƏSDİQ GÖZLƏYİR | `backend/src/app.js`, cookie `SameSite=None` (production) | Cookie ilə autentifikasiya olan, gövdəsiz "sadə" POST-lar (məs. `POST /api/orders/:id/refund`, `/api/tables/:id/regenerate`, `/api/auth/logout-all`) başqa saytdan CSRF ilə çağırıla bilər (CORS yalnız cavabı gizlədir, sorğunu dayandırmır) | Planlaşdırılıb: `Origin`/`Sec-Fetch-Site` yoxlaması (cross-site state-dəyişən sorğu → 403) | — |
| F3 | Orta | TƏSDİQ GÖZLƏYİR | `POST /api/tables/:code/call-waiter`, `/request-bill` | Yalnız təxmin edilə bilən masa kodu (`table_001`) lazımdır; QR tokeni yoxdur → kənardan istənilən masaya çağırış/hesab bildirişi yaratmaq olar | Planlaşdırılıb: sürət məhdudiyyəti və/və ya QR tokeni | — |
| F4 | Aşağı | TƏSDİQ GÖZLƏYİR | `GET /api/tables` | `qr_token`-lər bütün işçi rollarına (KITCHEN daxil) qaytarılır; UI-da Masalar səhifəsi KITCHEN-ə bağlıdır, API isə açıq | Planlaşdırılıb: `authorize('OWNER','MANAGER','WAITER')` | — |
| F5 | Orta | TƏSDİQ GÖZLƏYİR | `backend/src/app.js` | CSP və HSTS başlıqları yoxdur (yalnız nosniff/X-Frame/Referrer) | Planlaşdırılıb (production-da HSTS; CSP diqqətlə — inline splash, Google Fonts, Unsplash şəkilləri) | — |
| F6 | Aşağı | TƏSDİQ GÖZLƏYİR | `authService.js` | `jwt.verify` alqoritmi sabitləmir | Planlaşdırılıb: `algorithms: ['HS256']` | — |

## Yoxlanıb, problem YOXDUR (sübutla)
- SEO inyeksiyası: `escapeHtml` + `safeJson` (`<`, `>`, `&` escape) — JSON-LD/meta XSS yoxdur (kod oxundu; dinamik test hələ də edilməlidir).
- Cookie bayraqları: httpOnly, `secure` production-da, refresh cookie yalnız `/api/auth` yoluna (kod oxundu).
- CORS: `origin` sabit (`CLIENT_ORIGIN`), yansıdılmır.
- Admin socket namespace: JWT cookie ilə orta qatda doğrulanır.
- Mail şablonları HTML escape edir; CSV ixracı formula inyeksiyasını neytrallaşdırır (əvvəlki testlərlə).

## Test nəticələri
Başlanğıc (QA-dan əvvəl): Jest 367, Vitest 204, Playwright 5 keçir (+PWA atlanır).
