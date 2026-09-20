# QA vəziyyət faylı — yeni sessiya BURADAN davam edir

Status: DAVAM EDİR
Son yenilənmə: sessiya 1 (yoxlama nöqtəsi 6) | Sessiya sayı: 1

## NÖVBƏTİ ADDIM (dəqiq, bir-iki cümlə)
E bölməsinin dinamik hissəsi (rol matrisi, injection/fuzz, mass assignment, IDOR, fayl yükləmə, socket, məlumat sızması) BİTDİ. Qalan E: **F5 başlıqlar (HSTS/CSP)** — production-da HSTS, CSP diqqətlə (inline splash, Google Fonts, Unsplash şəkilləri, socket); sonra **rate limit/DoS** dərin yoxlama (yük testində K ilə birlikdə), yarış halları (K-da). Sonra C (ödəniş) → D (e-poçt) → B (admin panel, brauzerdə hər rol) → A (müştəri saytı) → F → G → H → K (300 sifariş, `LOADTEST-` işarəsi) → I → J. Skriptlər: `qa/rbac-matrix.js`, `qa/probes.js` (yüksək limitli ikinci nüsxə üçün `PORT=4001 EMAIL_FLOW_LIMIT=100000 node src/server.js`, sonra `QA_BASE=http://localhost:4001`).

## Yoxlama siyahısı (prioritet sırası ilə)
- [x] 0. Başlanğıc: serverlər qalxdı (4000/5174 işləyir), mövcud testlər son işlədildikdə keçdi (Jest 367, Vitest 204, PW 5)
- [ ] E. Təhlükəsizlik
  - [x] AuthN/AuthZ: route xəritəsi + F1/F3/F4/F6/F7; dinamik rol matrisi 398 kombinasiya — problem yoxdur (rol×endpoint, yol variantları, HEAD, method-override, token variantları, API ilə rol endirilməsi, logout-all)
  - [x] CSRF/CORS: F2 düzəldildi və canlı təsdiqləndi (csrfGuard). CORS origin sabit — problem yoxdur
  - [x] Injection: 120 SQL/NoSQL/XSS/traversal fuzz sorğusu (public + admin filtrlər) — F10 düzəldildi; React-də `dangerouslySetInnerHTML` yoxdur; SEO escaping kodla təsdiqli. (SSRF/open redirect: istifadəçi URL-i açan kod yoxdur)
  - [x] Fayl yükləmə: 8 problar (saxta MIME, SVG, PHP, traversal, polyglot, 6MB, .exe) — problem yoxdur (magic bytes)
  - [x] Mass assignment: status/payment_status/total/id/restaurant_id/paid_at müştəridən qəbul edilmir; qiymət serverdə — problem yoxdur; F9 (giriş hədləri) düzəldildi
  - [~] Rate limiting və DoS: limiterlər var (login 5, e-poçt axını 10, ümumi 3000); F12 düzəldildi; dərin yoxlama K-da
  - [x] Məlumat sızması: git/sirlər (F8), xəta cavabları/traversal probları, /health (F11), socket PII — düzəldildi/təmiz
  - [ ] Başlıqlar/transport (F5: HSTS/CSP)
  - [ ] Yarış halları (K-da)
  - [x] Asılılıqlar (npm audit): backend 0, frontend 0 zəiflik
  - [x] Socket.io: join-order token tələb edir, /admin girişsiz rədd, public klient PII almır
- [ ] C. Ödəniş sistemi
- [ ] D. E-poçt / şifrə bərpası
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
| ikinci backend nüsxəsi (port 4001) | proses | portu dinləyən prosesi dayandır | DAYANDIRILDI (istifadə ediləndə yenidən başladılır, sonda dayandırılmalıdır) |

## Qərarımı tələb edən / düzəldilməyən məsələlər
- Admin şifrəsi hələ də defoltdur — SAHİB dəyişməlidir (QA dəyişmir).
- `.env` JWT_SECRET zəifdir (secret/12345) — canlıdan əvvəl SAHİB yeni açar yaratmalıdır.
- Qeyd (dəyişdirilmədi, dizayn): `authenticate` rol/versiya vəziyyətini 10 san keşləyir; rol API ilə (OWNER → Komanda) dəyişəndə keş dərhal silinir (təsdiqləndi). DB-də birbaşa dəyişiklik ≤10 san gecikir.

## Sessiya jurnalı (hər sessiya: nə edildi, harada dayandı)
- Sessiya 1 (nöqtə 6): dinamik rol matrisi (398 kombinasiya, təmiz) + `qa/probes.js` (injection/fuzz, mass assignment, IDOR, upload, socket). Tapıntılar F9–F13 düzəldildi (giriş hədləri, DB parametr xətaları 400, /health, e-poçt limiterində GET, səbət miqdarı). Jest 397, Vitest 210. Backend (4000) yenidən başladıldı.
- Sessiya 1 (nöqtə 5): npm audit (0/0), git sirr axtarışı (təmiz), F8 zəif JWT_SECRET → secretsCheck (production-da server imtina edir). Jest 387.
- Sessiya 1 (nöqtə 4): F1 (defolt admin şifrəsi bannerı + server xəbərdarlığı; canlı təsdiq: real admin defolt şifrədədir) düzəldildi. Jest 382, Vitest 210. Backend yenidən başladıldı.
- Sessiya 1 (nöqtə 3): F3 (QR tokeni çağırışlarda), F4 (GET /tables rolları), F6 (JWT HS256), F7 (timingSafeEqual) düzəldildi; testlər: Jest 378, Vitest 208. Backend yenidən başladıldı.
- Sessiya 1 (nöqtə 2): F2 CSRF düzəldildi (csrfGuard + 5 test), backend yenidən başladıldı, E2E keçdi. Commit: "QA: CSRF guard".
- Sessiya 1: promptun davamlılıq versiyası yaradıldı; route icazə xəritəsi, cookie/JWT/CORS/SEO/socket kodları oxundu; QA_REPORT.md-də F1–F6 namizədləri yazıldı.
