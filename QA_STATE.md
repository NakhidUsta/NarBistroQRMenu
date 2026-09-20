# QA vəziyyət faylı — yeni sessiya BURADAN davam edir

Status: DAVAM EDİR
Son yenilənmə: sessiya 1 (yoxlama nöqtəsi 1) | Sessiya sayı: 1

## NÖVBƏTİ ADDIM (dəqiq, bir-iki cümlə)
F2, F3, F4, F6, F7 BİTDİ. Qalan: F1 (defolt `ChangeMe123!` ilə girişdə admin panel bannerı + server açılışında xəbərdarlıq; şifrəni dəyişmə!), F5 (HSTS production-da; CSP ehtiyatla). Sonra E-nin qalan alt-bəndləri: dinamik rol matrisi (4 müvəqqəti rol — ƏVVƏL dəftərə yaz), injection (dinamik SQL/XSS probları), fayl yükləmə, mass assignment, rate limit, məlumat sızması (xəta mesajları, socket, git tarixçəsində sirlər), npm audit, socket. Sonra C → D → B → A ...

## Yoxlama siyahısı (prioritet sırası ilə)
- [x] 0. Başlanğıc: serverlər qalxdı (4000/5174 işləyir), mövcud testlər son işlədildikdə keçdi (Jest 367, Vitest 204, PW 5)
- [ ] E. Təhlükəsizlik
  - [~] AuthN/AuthZ: route xəritəsi + F3/F4/F6/F7 düzəldildi; F1 gözləyir; dinamik rol matrisi HƏLƏ EDİLMƏYİB
  - [x] CSRF/CORS: F2 düzəldildi və canlı təsdiqləndi (csrfGuard). CORS origin sabit — problem yoxdur
  - [ ] Injection (SQL, XSS, CSV, header/log, SSRF/open redirect)
  - [ ] Fayl yükləmə
  - [ ] Mass assignment
  - [ ] Rate limiting və DoS
  - [ ] Məlumat sızması (xətalar, token, PII, loglar, git tarixçəsi)
  - [ ] Başlıqlar/transport
  - [ ] Yarış halları
  - [ ] Asılılıqlar (npm audit)
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
| — | — | — | — |

## Qərarımı tələb edən / düzəldilməyən məsələlər
—

## Sessiya jurnalı (hər sessiya: nə edildi, harada dayandı)
- Sessiya 1 (nöqtə 3): F3 (QR tokeni çağırışlarda), F4 (GET /tables rolları), F6 (JWT HS256), F7 (timingSafeEqual) düzəldildi; testlər: Jest 378, Vitest 208. Backend yenidən başladıldı.
- Sessiya 1 (nöqtə 2): F2 CSRF düzəldildi (csrfGuard + 5 test), backend yenidən başladıldı, E2E keçdi. Commit: "QA: CSRF guard".
- Sessiya 1: promptun davamlılıq versiyası yaradıldı; route icazə xəritəsi, cookie/JWT/CORS/SEO/socket kodları oxundu; QA_REPORT.md-də F1–F6 namizədləri yazıldı. Hələ heç bir kod dəyişikliyi/düzəliş edilməyib. Müvəqqəti məlumat yaradılmayıb.
