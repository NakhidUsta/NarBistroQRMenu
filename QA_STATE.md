# QA vəziyyət faylı — yeni sessiya BURADAN davam edir

Status: DAVAM EDİR
Son yenilənmə: sessiya 1 (yoxlama nöqtəsi 9) | Sessiya sayı: 1

## NÖVBƏTİ ADDIM (dəqiq, bir-iki cümlə)
E (təhlükəsizlik), C (ödəniş), D (e-poçt/şifrə bərpası) BİTDİ (F1–F21 düzəldildi; rate limit/DoS dərini və yarış halları K-da). İNDİ: **B (admin panel)** — real brauzerdə (Browser pane, `http://localhost:5174/admin`, real admin `admin@qrmenu.local` defolt şifrə ilə OWNER; digər rollar üçün `qa.tmp.rbac.*` müvəqqəti hesablar dəftərə yazıldıqdan sonra): hər səhifə üçün yüklənmə, boş/xəta vəziyyəti, formalar (validasiya), siyahı/səhifələmə, real-time (socket) yeniləmə, rol üzrə menyu/düymə görünüşü (WAITER/KITCHEN-ə qadağan olan səhifələr), konsol xətaları, mobil görünüş; sonra A (müştəri saytı) → A (müştəri saytı) → F → G → H → K (300 sifariş, `LOADTEST-` işarəsi) → I → J. Skriptlər: `qa/rbac-matrix.js`, `qa/probes.js` (yüksək limitli ikinci nüsxə üçün `PORT=4001 EMAIL_FLOW_LIMIT=100000 node src/server.js`, sonra `QA_BASE=http://localhost:4001`).

## Yoxlama siyahısı (prioritet sırası ilə)
- [x] 0. Başlanğıc: serverlər qalxdı (4000/5174 işləyir), mövcud testlər son işlədildikdə keçdi (Jest 367, Vitest 204, PW 5)
- [x] E. Təhlükəsizlik (rate limit/yarış halları dərini K-da)
  - [x] AuthN/AuthZ: route xəritəsi + F1/F3/F4/F6/F7; dinamik rol matrisi 398 kombinasiya — problem yoxdur (rol×endpoint, yol variantları, HEAD, method-override, token variantları, API ilə rol endirilməsi, logout-all)
  - [x] CSRF/CORS: F2 düzəldildi və canlı təsdiqləndi (csrfGuard). CORS origin sabit — problem yoxdur
  - [x] Injection: 120 SQL/NoSQL/XSS/traversal fuzz sorğusu (public + admin filtrlər) — F10 düzəldildi; React-də `dangerouslySetInnerHTML` yoxdur; SEO escaping kodla təsdiqli. (SSRF/open redirect: istifadəçi URL-i açan kod yoxdur)
  - [x] Fayl yükləmə: 8 problar (saxta MIME, SVG, PHP, traversal, polyglot, 6MB, .exe) — problem yoxdur (magic bytes)
  - [x] Mass assignment: status/payment_status/total/id/restaurant_id/paid_at müştəridən qəbul edilmir; qiymət serverdə — problem yoxdur; F9 (giriş hədləri) düzəldildi
  - [~] Rate limiting və DoS: limiterlər var (login 5, e-poçt axını 10, ümumi 3000); F12 düzəldildi; dərin yoxlama K-da
  - [x] Məlumat sızması: git/sirlər (F8), xəta cavabları/traversal probları, /health (F11), socket PII — düzəldildi/təmiz
  - [x] Başlıqlar/transport: F5 düzəldildi (HSTS production-da, CSP hash-li, real brauzerdə təsdiq)
  - [ ] Yarış halları (K-da)
  - [x] Asılılıqlar (npm audit): backend 0, frontend 0 zəiflik
  - [x] Socket.io: join-order token tələb edir, /admin girişsiz rədd, public klient PII almır
- [x] C. Ödəniş sistemi: 32+ dinamik yoxlama (real DB, test provayderi) keçdi; F13–F17 düzəldildi (vaxt-aşımı CHECK xətası, ləğvdə stok, ləğv edilmiş sifariş açılması, refund-suz ləğv, sweeper yarışı). Real Epoint sandbox açarları olmadan yoxlanmadı (sahib açar əlavə edəndən sonra `npm run payment:check`)
- [x] D. E-poçt / şifrə bərpası: 54 dinamik yoxlama (console driver, real DB) keçdi; F18 (paylaşılan IP giriş bloku), F19 (şifrə tip/uzunluq), F20 (məktub limiti yarışı), F21 (massiv e-poçt) düzəldildi. Real Gmail SMTP göndərişi yoxlanmadı (App Password lazımdır — sahib paneldə daxil edəndən sonra "Sınaq məktubu göndər")
- [ ] B. Admin panel
  - [ ] OWNER (hər səhifə + endpoint)
  - [ ] MANAGER
  - [ ] WAITER
  - [ ] KITCHEN
  - [ ] Siyahılar, formalar, boş/xəta vəziyyətləri, real-time
- [ ] A. Müştəri saytı
  - [ ] Menyu, kateqoriya/məhsul səhifələməsi, axtarış, filtr
  - [ ] Məhsul səhifəsi
  - [ ] Səbət, sifariş, ödəniş axınları
  - [ ] Sifariş səhifəsi, Sifarişlərim, Sevimlilər
  - [ ] Masa/QR məntiqi
  - [ ] Dillər, splash, responsiv (1280/768/375)
  - [ ] PWA/offline, SEO, əlçatanlıq, performans
- [ ] F. Verilənlər bazası (schema.sql sıfır DB, migrasiyalar, məhdudiyyətlər)
- [ ] G. Backend keyfiyyəti
- [ ] H. Frontend keyfiyyəti
- [ ] K. Yük testi (300 sifariş) — skript: qa/loadtest.js
  - [ ] 1. Ardıcıl
  - [ ] 2. Paralel (10/25/50)
  - [ ] 3. Qarışıq ssenari
  - [ ] 4. Yarış halları
  - [ ] 5. Qiymət manipulyasiyası
  - [ ] 6. Real-time
  - [ ] 7. Yükdən sonra panel/sayt
  - [ ] Bütövlük yoxlaması + təmizlik
- [ ] I. Testlər (boşluqlar, flaky)
- [ ] J. Canlıya hazırlıq (deploy)
- [ ] Yekun: QA_REPORT.md tam, təmizlik yoxlandı, commit-lər hazır

## Başlanğıc rəqəmlər (test sayları, əvvəl/sonra)
Bu layihədə sonuncu məlum vəziyyət (QA-dan əvvəl): Jest 367, Vitest 204, Playwright 5 keçir (+PWA testi E2E_PROD tələb edir, atlanır).

## Müvəqqəti məlumat dəftəri (təmizlənməlidir)
| tip | identifikator/işarə | silmə əmri | silindi? |
|---|---|---|---|
| müvəqqəti admin hesabları (4 rol) | `qa.tmp.rbac.<ROL>@example.test` + `audit_logs` qeydləri | `cd backend && node ../qa/rbac-matrix.js --cleanup` | SİLİNDİ (skript özü təmizləyir; SQL ilə yoxlanıb: qalan=0) |
| probes.js məlumatı | hesab `qa.tmp.rbac.owner@example.test`; sifarişlər `customer_name LIKE 'QA-PROBE%'`; yüklənən media; probların yaratdığı `system_error` bildirişləri | `cd backend && node ../qa/probes.js --cleanup` (+ `DELETE FROM notifications WHERE type='system_error' AND created_at > <probe vaxtı>`) | SİLİNDİ (yoxlanıb: sifariş=0, hesab=0, media=0, probe bildirişləri silindi) |
| payment-probes.js məlumatı | hesablar `qa.tmp.rbac.*`; məhsul `QA-TMP Stok%` (+stock_movements); sifarişlər `customer_name LIKE 'QA-PAY%'` (+payments cascade); skriptin başladığı andan sonrakı `notifications` | `cd backend && node ../qa/payment-probes.js --cleanup` (bildirişləri əl ilə: `DELETE FROM notifications WHERE created_at > <başlanğıc vaxtı>`) | SİLİNDİ (yoxlanıb: sifariş=0, məhsul=0, hesab=0; probe bildirişləri silindi) |
| mail-probes.js məlumatı | hesablar `qa.tmp.rbac.owner@` və `qa.tmp.rbac.newmail@example.test` (email_tokens cascade); jurnal faylı scratchpad-də | `cd backend && node ../qa/mail-probes.js --cleanup` | SİLİNDİ (yoxlanıb: qalan=0) |
| ikinci backend nüsxəsi (port 4001) | proses | portu dinləyən prosesi dayandır | DAYANDIRILDI |

## Qərarımı tələb edən / düzəldilməyən məsələlər
- Admin şifrəsi hələ də defoltdur — SAHİB dəyişməlidir (QA dəyişmir).
- `.env` JWT_SECRET zəifdir (secret/12345) — canlıdan əvvəl SAHİB yeni açar yaratmalıdır.
- Qeyd (dəyişdirilmədi, dizayn): `authenticate` rol/versiya vəziyyətini 10 san keşləyir; rol API ilə (OWNER → Komanda) dəyişəndə keş dərhal silinir (təsdiqləndi). DB-də birbaşa dəyişiklik ≤10 san gecikir.

## Sessiya jurnalı (hər sessiya: nə edildi, harada dayandı)
- Sessiya 1 (nöqtə 9): D bitdi — `qa/mail-probes.js` (54 yoxlama). F18–F21: giriş limiti IP+e-poçt/IP iki qat (paylaşılan Wi-Fi-da hamını bloklamırdı), `passwordPolicy` (8–128 simvol, yalnız mətn), sıfırlama məktubu limiti yarışı, massiv e-poçt qəbulu. Jest 419 (26 dəst). Backend 4000 yenidən başladıldı, 4001 dayandırıldı.
- Sessiya 1 (nöqtə 8): C bitdi — `qa/payment-probes.js` real DB-də 5 real səhv tapdı: F13 (miqrasiya 019: `order_expired` CHECK pozurdu → vaxtı keçən sifarişlər heç vaxt ləğv olunmurdu), F14 (ləğvdə stok qaytarılmırdı), F15 (ləğv edilmiş sifariş açılırdı), F16 (ödənilmiş onlayn sifariş refund-suz ləğv), F17 (sweeper yarışı). Jest 411, Playwright 5. Backend 4000 yenidən başladıldı (019 tətbiq olunub), 4001 dayandırıldı.
- Sessiya 1 (nöqtə 7): F5 düzəldildi — `securityHeaders.js` (HSTS production-da, Permissions-Policy, API üçün default-src none, HTML üçün hash-li CSP). Real brauzerdə (istehsal build, backend-dən xidmət) menyu+admin+şriftlər+şəkillər+socket+WebSocket CSP pozuntusu olmadan işlədi. Jest 404 (25 dəst). `DEPLOY.md` yeniləndi. Backend 4000 yenidən başladıldı.
- Sessiya 1 (nöqtə 6): dinamik rol matrisi (398 kombinasiya, təmiz) + `qa/probes.js` (injection/fuzz, mass assignment, IDOR, upload, socket). Tapıntılar F9–F13 düzəldildi (giriş hədləri, DB parametr xətaları 400, /health, e-poçt limiterində GET, səbət miqdarı). Jest 397, Vitest 210. Backend (4000) yenidən başladıldı.
- Sessiya 1 (nöqtə 5): npm audit (0/0), git sirr axtarışı (təmiz), F8 zəif JWT_SECRET → secretsCheck (production-da server imtina edir). Jest 387.
- Sessiya 1 (nöqtə 4): F1 (defolt admin şifrəsi bannerı + server xəbərdarlığı; canlı təsdiq: real admin defolt şifrədədir) düzəldildi. Jest 382, Vitest 210. Backend yenidən başladıldı.
- Sessiya 1 (nöqtə 3): F3 (QR tokeni çağırışlarda), F4 (GET /tables rolları), F6 (JWT HS256), F7 (timingSafeEqual) düzəldildi; testlər: Jest 378, Vitest 208. Backend yenidən başladıldı.
- Sessiya 1 (nöqtə 2): F2 CSRF düzəldildi (csrfGuard + 5 test), backend yenidən başladıldı, E2E keçdi. Commit: "QA: CSRF guard".
- Sessiya 1: promptun davamlılıq versiyası yaradıldı; route icazə xəritəsi, cookie/JWT/CORS/SEO/socket kodları oxundu; QA_REPORT.md-də F1–F6 namizədləri yazıldı.
