# QA vəziyyət faylı — yeni sessiya BURADAN davam edir

Status: DAVAM EDİR
Son yenilənmə: sessiya 1 (yoxlama nöqtəsi 1) | Sessiya sayı: 1

## NÖVBƏTİ ADDIM (dəqiq, bir-iki cümlə)
F2 BİTDİ. Növbəti: F6 (jwt.verify `algorithms: ['HS256']`), F4 (`GET /api/tables` → authorize OWNER/MANAGER/WAITER), F3 (call-waiter/request-bill üçün QR tokeni tələb et: backend tableService/controller + frontend tableSessionStore token saxlasın, TableActions göndərsin, testləri yenilə), F1 (defolt şifrə ilə girişdə panel bannerı + server xəbərdarlığı), F5 (HSTS production-da; CSP ehtiyatla). Sonra E-nin qalan alt-bəndləri: dinamik rol matrisi, injection, fayl yükləmə, mass assignment, rate limit, sızma, asılılıqlar (npm audit), socket. Hər düzəlişdən sonra backend testləri + commit + bu faylı yenilə.

## Yoxlama siyahısı (prioritet sırası ilə)
- [x] 0. Başlanğıc: serverlər qalxdı (4000/5174 işləyir), mövcud testlər son işlədildikdə keçdi (Jest 367, Vitest 204, PW 5)
- [ ] E. Təhlükəsizlik
  - [~] AuthN/AuthZ: route xəritəsi çıxarıldı (F1, F3, F4, F6 namizədləri); dinamik rol matrisi HƏLƏ EDİLMƏYİB
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
- Sessiya 1 (nöqtə 2): F2 CSRF düzəldildi (csrfGuard + 5 test), backend yenidən başladıldı, E2E keçdi. Commit: "QA: CSRF guard".
- Sessiya 1: promptun davamlılıq versiyası yaradıldı; route icazə xəritəsi, cookie/JWT/CORS/SEO/socket kodları oxundu; QA_REPORT.md-də F1–F6 namizədləri yazıldı. Hələ heç bir kod dəyişikliyi/düzəliş edilməyib. Müvəqqəti məlumat yaradılmayıb.
