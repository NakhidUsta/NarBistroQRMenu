# QA vəziyyət faylı — yeni sessiya BURADAN davam edir

Status: DAVAM EDİR
Son yenilənmə: sessiya 1 (yoxlama nöqtəsi 1) | Sessiya sayı: 1

## NÖVBƏTİ ADDIM (dəqiq, bir-iki cümlə)
E bölməsi: QA_REPORT.md-dəki F1–F6 namizədlərini **ardıcıllıqla** təsdiqlə və düzəlt: əvvəl F2 (CSRF: dinamik təsdiq — `Origin: https://evil.example` ilə cookie-li gövdəsiz POST 403 qaytarmalıdır; app.js-ə `Origin/Sec-Fetch-Site` middleware + test), sonra F1 (defolt şifrə bannerı), F3, F4, F6, F5. Hər düzəlişdən sonra backend testləri + commit + bu faylı yenilə. Müvəqqəti admin lazımdırsa, ƏVVƏL dəftərə yaz (e-poçt şablonu `qa.tmp.<n>@example.test`).

## Yoxlama siyahısı (prioritet sırası ilə)
- [x] 0. Başlanğıc: serverlər qalxdı (4000/5174 işləyir), mövcud testlər son işlədildikdə keçdi (Jest 367, Vitest 204, PW 5)
- [ ] E. Təhlükəsizlik
  - [~] AuthN/AuthZ: route xəritəsi çıxarıldı (F1, F3, F4, F6 namizədləri); dinamik rol matrisi HƏLƏ EDİLMƏYİB
  - [~] CSRF/CORS: F2 tapıldı (kod oxundu), dinamik təsdiq və düzəliş gözləyir
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
- Sessiya 1: promptun davamlılıq versiyası yaradıldı; route icazə xəritəsi, cookie/JWT/CORS/SEO/socket kodları oxundu; QA_REPORT.md-də F1–F6 namizədləri yazıldı. Hələ heç bir kod dəyişikliyi/düzəliş edilməyib. Müvəqqəti məlumat yaradılmayıb.
