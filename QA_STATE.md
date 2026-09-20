# QA vəziyyət faylı — yeni sessiya BURADAN davam edir

Status: BAŞLANMAYIB
Son yenilənmə: — | Sessiya sayı: 0

## NÖVBƏTİ ADDIM (dəqiq, bir-iki cümlə)
QA_PROMPT.md-ni oxu. Serverləri (4000, 5174) qaldır, mövcud testləri işlət (backend, frontend, playwright), rəqəmləri aşağıdakı "Başlanğıc rəqəmlər"ə yaz, sonra **E. Təhlükəsizlik** bölməsindən başla.

## Yoxlama siyahısı (prioritet sırası ilə)
- [ ] 0. Başlanğıc: serverlər qalxdı, mövcud testlər işlədildi, rəqəmlər aşağıda
- [ ] E. Təhlükəsizlik
  - [ ] AuthN/AuthZ (route-lar, IDOR, JWT/cookie, refresh rotasiyası, brute-force)
  - [ ] CSRF/CORS
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
—
