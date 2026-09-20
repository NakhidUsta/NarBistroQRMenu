# QA vəziyyət faylı — yeni sessiya BURADAN davam edir

Status: DAVAM EDİR
Son yenilənmə: sessiya 1 (yoxlama nöqtəsi 1) | Sessiya sayı: 1

## NÖVBƏTİ ADDIM (dəqiq, bir-iki cümlə)
F1–F4, F6–F8 BİTDİ; npm audit təmiz; git-də sirr yoxdur. Qalan: **dinamik rol matrisi** (ƏVVƏL dəftərə yaz; 4 müvəqqəti hesab `qa.tmp.<n>@example.test`, hər rol üçün giriş edib bütün endpoint-ləri yoxla; `qa/rbac-matrix.js` skripti yaz, `--cleanup` rejimi ilə), sonra injection/XSS dinamik problar, fayl yükləmə probları, mass assignment, rate limit, məlumat sızması (xəta mesajları, socket otaqları), F5 (HSTS/CSP). Sonra C → D → B → A → F → G → H → K → I → J.

## Yoxlama siyahısı (prioritet sırası ilə)
- [x] 0. Başlanğıc: serverlər qalxdı (4000/5174 işləyir), mövcud testlər son işlədildikdə keçdi (Jest 367, Vitest 204, PW 5)
- [ ] E. Təhlükəsizlik
  - [~] AuthN/AuthZ: route xəritəsi + F1/F3/F4/F6/F7 düzəldildi; dinamik rol matrisi HƏLƏ EDİLMƏYİB
  - [x] CSRF/CORS: F2 düzəldildi və canlı təsdiqləndi (csrfGuard). CORS origin sabit — problem yoxdur
  - [ ] Injection (SQL, XSS, CSV, header/log, SSRF/open redirect)
  - [ ] Fayl yükləmə
  - [ ] Mass assignment
  - [ ] Rate limiting və DoS
  - [~] Məlumat sızması: git tarixçəsi/sirlər yoxlandı (təmiz), F8 (zəif JWT_SECRET) düzəldildi; xəta mesajları/socket/PII HƏLƏ yoxlanmayıb
  - [ ] Başlıqlar/transport
  - [ ] Yarış halları
  - [x] Asılılıqlar (npm audit): backend 0, frontend 0 zəiflik
  - [ ] Socket.io
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
| müvəqqəti admin hesabları (4 rol) | `qa.tmp.rbac.<ROL>@example.test` (OWNER/MANAGER/WAITER/KITCHEN) + onların `audit_logs`/`admin_sessions` qeydləri | `cd backend && node ../qa/rbac-matrix.js --cleanup` | HƏLƏ YARADILMAYIB (skript işləyəndə yaranır, sonda özü silir) |

## Qərarımı tələb edən / düzəldilməyən məsələlər
- Admin şifrəsi hələ də defoltdur — SAHİB dəyişməlidir (QA dəyişmir).
- `.env` JWT_SECRET zəifdir (secret/12345) — canlıdan əvvəl SAHİB yeni açar yaratmalıdır.

## Sessiya jurnalı (hər sessiya: nə edildi, harada dayandı)
- Sessiya 1 (nöqtə 5): npm audit (0/0), git sirr axtarışı (təmiz), F8 zəif JWT_SECRET → secretsCheck (production-da server imtina edir). Jest 387.
- Sessiya 1 (nöqtə 4): F1 (defolt admin şifrəsi bannerı + server xəbərdarlığı; canlı təsdiq: real admin defolt şifrədədir) düzəldildi. Jest 382, Vitest 210. Backend yenidən başladıldı.
- Sessiya 1 (nöqtə 3): F3 (QR tokeni çağırışlarda), F4 (GET /tables rolları), F6 (JWT HS256), F7 (timingSafeEqual) düzəldildi; testlər: Jest 378, Vitest 208. Backend yenidən başladıldı.
- Sessiya 1 (nöqtə 2): F2 CSRF düzəldildi (csrfGuard + 5 test), backend yenidən başladıldı, E2E keçdi. Commit: "QA: CSRF guard".
- Sessiya 1: promptun davamlılıq versiyası yaradıldı; route icazə xəritəsi, cookie/JWT/CORS/SEO/socket kodları oxundu; QA_REPORT.md-də F1–F6 namizədləri yazıldı. Hələ heç bir kod dəyişikliyi/düzəliş edilməyib. Müvəqqəti məlumat yaradılmayıb.
