# QA vəziyyət faylı — yeni sessiya BURADAN davam edir

Status: **BİTDİ** (bütün bölmələr E–J tamamlandı; yekun hesabat istifadəçiyə verildi)
Son yenilənmə: sessiya 1 (yoxlama nöqtəsi 13) | Sessiya sayı: 1

## ⚠ HADİSƏ (sessiya 1, nöqtə 11): baza yanlışlıqla sıfırlandı və bərpa edildi
A bölməsinə başlayarkən F22 tapıntısını (aşağıda) sınamaq üçün `schema.sql`-i AYRICA sınaq bazasında (`qr_menu_qa_schema_test`) işlətdim. Faylın daxilində sərt yazılmış `USE qr_menu;` (8-ci sətir) mənim verdiyim `-d` bazasını ləğv etdi və **bütün skript əsl `qr_menu` bazasına qarşı işlədi** (DROP+CREATE bütün cədvəllər + yalnız seed data). Nəticə: 56 məhsul→6, bütün sifarişlər/rəylər silindi, 3 admin hesabından biri (`NakhidSafarov@gmail.com`) yoxa çıxdı. Dərhal DAYANDIRILDI, istifadəçiyə bildirildi. SQL Server-in öz backup tarixçəsindən (`msdb.dbo.backupset`) YEGANƏ backup tapıldı: 2026-09-19 14:39 (çox köhnə — miqrasiya 002-019-dan ƏVVƏL, 15 cədvəl əvəzinə tələb olunan 26-dan). İstifadəçinin təsdiqi ilə: (1) bu backup bərpa edildi, (2) miqrasiyalar 002→019 ardıcıl (əlavə-yönlü, DROP DATABASE yox) tətbiq edildi — sxem indi tamdır (26 cədvəl, Jest 419/Vitest 212 keçir), (3) itirilmiş menyu məzmunu (15 yeni kateqoriya, 50 yeni məhsul, "Nar Bistro" brendinqi) bu sessiyada əvvəllər brauzerdə görülmüş real adlar/qiymətlərə əsaslanaraq `qa/recover-menu-content.js` ilə YENİDƏN YARADILDI (dəqiq eyni deyil, oxşar keyfiyyətdə — bax aşağıda "Bərpa qeydləri"). **DƏRS**: bundan sonra `schema.sql`/miqrasiya faylı heç vaxt canlı/dev bazaya `-i` ilə birbaşa işlədilmir — əvvəlcə faylın için `USE` axtarılır, sınaq lazımdırsa fayl KOPYALANIB `USE`-suz versiya ilə test edilir.

## Bərpa qeydləri (istifadəçiyə bildirilməli, işin sonunda təkrar xatırladılsın)
- Restoran: ad "Nar Bistro", brendinq (rənglər, hero, banner, footer mətni), ünvan, iş saatları — bərpa edildi (əvvəlki brauzer sessiyasından yadda saxlanan mətnlərlə).
- 19 kateqoriya, 56 məhsul (qiymət/təsvir/şəkil ilə) yenidən yaradıldı — **adlar/təsvirlər orijinaldan fərqli ola bilər** (dəqiq mətn saxlanılmamışdı), şəkillər Unsplash stok fotolarıdır (real deyil).
- `NakhidSafarov@gmail.com` (OWNER) hesabı YENİ, təsadüfi şifrə ilə yaradıldı — şifrə YALNIZ söhbətdə (bu fayla YAZILMADI, təhlükəsizlik səbəbi) istifadəçiyə deyildi. **İSTİFADƏÇİ BU ŞİFRƏNİ DƏRHAL DƏYİŞMƏLİDİR** (Hesabım → Şifrəni dəyiş).
- `google_maps_link`, `tiktok_link`, `instagram_link`, `phone`, `whatsapp` sahələri BOŞ buraxıldı (uydurma məlumat yazılmadı) — istifadəçi bunları Ayarlar-dan özü doldurmalıdır.
- İtirilən, bərpa edilməyən: bütün əvvəlki sifariş tarixçəsi (yalnız 19 sentyabr backup-dakı 5 test sifarişi qaldı), Nahid-in yazdığı rəy, audit log tarixçəsi.
- Real Epoint/Gmail açarları `.env`-də saxlanılıb (bazada deyil) — TƏSİRLƏNMƏYİB.

## NÖVBƏTİ ADDIM
YOXDUR — audit tamamlandı (E, C, D, B, A, F, G, H, K, I, J; F1–F27 düzəldildi). Əgər yeni sessiya bura baxırsa: bu tam bitmiş bir auditdir, təkrar başlamağa ehtiyac yoxdur. İstifadəçi yeni funksiya/dəyişiklik istəsə, bu, ayrı işdir — QA_REPORT.md-dəki "Sahibin etməli olduqları" siyahısı hələ də qüvvədədir (əsasən: admin şifrəsi, JWT_SECRET, Gmail, Epoint, backup, `NakhidSafarov@gmail.com` şifrəsi).

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
- [x] B. Admin panel: real brauzerdə (masaüstü+mobil 375px) 18 səhifə × OWNER (real hesab) + MANAGER/WAITER/KITCHEN (müvəqqəti, təmizlənib) — konsol xətası/error boundary/üfüqi daşma YOX; rol-əsaslı yönləndirmə (`homeFor`) real naviqasiyada (full reload) hər 3 aşağı roldan yoxlanıldı — işləyir (əvvəlki "bypass" tapıntısı test metodunun (manual pushState) məhdudiyyəti idi, təkrarlanmadı, DÜZƏLİŞ TƏLƏB OLUNMUR); mobil hamburger menyu işləyir. Formalar (kateqoriya/məhsul/masa+QR regenerate/promo/işçi) yaratma+validasiya (HTML5 required, qısa şifrə rədd)+silmə tam işləyir, audit log hər əməliyyatı doğru yazır (before/after diff), filtri işləyir. Real-time: API ilə yaradılan sifariş admin siyahısında REFRESH-SİZ göründü (socket). CSV ixracı (sifariş/məhsul) işləyir, formula-injection əvvəlki sessiyada təsdiqlənib. Stok/Bildirişlər/Media/Tərkiblər/Rəylər səhifələri boş/dolu vəziyyətdə düzgün göstərir. **Heç bir yeni bug tapılmadı, kod dəyişikliyi edilmədi**
- [x] A. Müştəri saytı (əsas axınlar tam sınandı; splash vizual/PWA/dərin əlçatanlıq auditi könüllü qaldı — aşağı prioritet)
  - [x] Menyu, kateqoriya səhifələməsi (1/3), məhsul səhifələməsi (5 səhifə), allergen filtri (56→31) — işləyir
  - [x] Məhsul səhifəsi: şəkil/ad/qiymət/hazırlanma vaxtı/tərkib/allergen/miqdar seçici — işləyir
  - [x] Səbət → checkout (HTML5 validasiya) → təsdiq modalı → NAĞD sifariş → sifariş izləmə — tam işlədi
  - [x] ONLAYN ödəniş: checkout→test ödəniş səhifəsi ("SINAQ REJİMİ" banneri ilə)→"Uğurlu ödə"→sifariş "Ödənilib" statusunda geri qayıtdı — tam işlədi (test provayderi ilə)
  - [x] Masa/QR rejimi: `?table=...&t=<token>` ilə "MASA 1" göstərilir, Ofisiant çağır/Hesab istə işləyir (mövcud OPEN bildirişi idempotent qaytarır — düzgün); yeni sessiyada YANLIŞ token → masasız rejimə düşür (F3 canlıda təsdiqləndi); köhnə (sabit) masa tokenləri F22 ilə yeniləndi
  - [x] Sifariş izləmə, Sifarişlərim, Sevimlilər (F23-dən sonra) — işləyir
  - [x] Dillər: AZ/EN/RU statik mətnləri düzgün tərcümə edir
  - [x] Responsiv: 1280/768/375 üfüqi daşma yoxdur (768-də əlavə yoxlanıldı)
  - [x] Əlçatanlıq: F24 (aşağıda, `<main>` landmark yox idi) tapıldı və düzəldildi; `alt` atributları hamısında var
  - [ ] Splash ekranın vizual (screenshot) təsdiqi, PWA/offline (`E2E_PROD=1` əl ilə build+serve), SEO view-source əl ilə — aşağı prioritetli, kodla/əvvəlki testlərlə artıq əhatə olunub, könüllü qalır
- [x] F. Verilənlər bazası: bütün 20 miqrasiya (002→020) əlavə-yönlü tətbiq olundu, sxem tamdır; F25 (indeks çatışmazlığı) tapıldı və düzəldildi; FK cascade/CHECK-lər nəzərdən keçirildi, problem yoxdur
- [x] G. Backend keyfiyyəti: bütün controller-lər `asyncHandler` ilə əhatələnib (istisna: `uploadFile` özü try/catch edir, `auth.config` sinxrondur — hər ikisi doğrudur); debug/`console.log`/TODO qalığı yoxdur; K yük testində F26 (bağlantı hovuzu) tapıldı və düzəldildi
- [x] H. Frontend keyfiyyəti: `console.log` qalığı yoxdur, `npm run build` xəbərdarlıqsız keçir, marşrut-səviyyəli lazy-loading artıq var (yaxşı təcrübə)
- [x] K. Yük testi (300+ sifariş) — skript: `qa/loadtest.js`. **F26 (Yüksək) tapıldı və düzəldildi**: DB bağlantı hovuzu konfiqurasiya edilməyib idi (defolt max 10) → 25/25 və 50/50 paralel sifariş 30 saniyə sonra "operation timed out" ilə 500 qaytarırdı (canlı restoranda bir neçə masa eyni anda sifariş versəydi baş verə bilərdi). Düzəlişdən sonra: hamısı 201
  - [x] 1. Ardıcıl: 50/50 uğurlu (p95 45ms)
  - [x] 2. Paralel (10/25/50): hamısı 201 (50 paralel → 661ms divar-vaxtı)
  - [x] 3. Qarışıq ssenari (sifariş+admin CRUD+oxuma eyni vaxtda): 5xx yoxdur
  - [x] 4. Yarış halları: eyni `client_request_id` ilə 10 paralel → tam 1 sifariş; 20 stokda 30 paralel sifariş → düzgün 20 uğurlu, mənfi stok yoxdur
  - [x] 5. Qiymət manipulyasiyası (yük altında): server öz qiymətini istifadə edir
  - [x] 6. Real-time: yükdən sonra socket hələ işləyir
  - [x] 7. Yükdən sonra panel/sayt: sağlamdır (health 14ms)
  - [x] Bütövlük yoxlaması (bütün sifarişlərdə total=sətirlərin cəmi) + təmizlik: keçdi, sıfır qalıq
- [x] I. Testlər: `.skip`/`xit`/`todo` axtarışı — yalnız 2 şərti skip var (`PAYMENT_PROVIDER`, `E2E_PROD`), hər ikisi legitimdir. PWA E2E əl ilə (`npm run build` + `vite preview` + `E2E_PROD=1`) icra edildi — keçdi. **F27 tapıldı və düzəldildi**: `full-flow.spec.js` menyu bərpasından sonra (56 məhsul) kövrək çıxdı, 90-120san asılı qalırdı (real bug deyil — testin köhnə az-məlumatlı seed fərziyyəsi; admin-in "Məhsul axtar" qutusu ilə düzəldildi)
- [x] J. Canlıya hazırlıq: DEPLOY.md nəzərdən keçirildi, `DB_POOL_MAX` (F26) və masa QR regenerate xatırlatması (F22) əlavə edildi. Qalan bütün "Sahibin etməli olduqları" `QA_REPORT.md`-də toplanıb (admin şifrəsi, JWT_SECRET, Gmail, Epoint, backup rejimi, `NakhidSafarov@gmail.com` şifrəsi)
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
| A (müştəri saytı) sifariş #126 | NAĞD test sifarişi ("QA-TMP Müştəri A") | — | BAZA HADİSƏSİ İLƏ SİLİNDİ (yuxarıdakı ⚠ bəndinə bax) — əlavə təmizlik lazım deyil |
| `qr_menu_qa_schema_test` sınaq bazası | boş sınaq bazası | `DROP DATABASE` | SİLİNDİ |
| `qa/recover-menu-content.js`, `qa/make-role-accounts.js` | bir dəfəlik bərpa/kömək skriptləri | — | SAXLANILIR (repoda qalır, sənədləşdirmə/təkrar istifadə üçün) |
| K (yük testi) məlumatı | hesab `qa.tmp.rbac.owner@example.test`; sifarişlər `customer_name LIKE 'LOADTEST-%'` (+payments/stock_movements/promo_usage cascade); məhsullar `LOADTEST-%` | `cd backend && node ../qa/loadtest.js --cleanup` | SİLİNDİ (2 dəfə işlədildi — 1-ci dəfə pool xətası ilə, 2-ci dəfə düzəlişdən sonra; hər ikisindən sonra yoxlanıb: qalan=0) |
| K üçün ikinci backend nüsxəsi (port 4001) | proses | portu dinləyən prosesi dayandır | DAYANDIRILDI |
| B (admin panel, brauzer) müvəqqəti hesabları/məlumatı | hesablar `qa.tmp.rbac.<rol>@example.test` (`qa/make-role-accounts.js` ilə, bilinən şifrə); brauzerdə yaradılan test məlumatı: kateqoriya "QA-TMP Kateqoriya", məhsul "QA-TMP Məhsul", masa "QA-TMP Masa", promo "QATMP10", işçi `qa.tmp.b.formcheck@example.test`, sifariş #125 (API ilə, `client_request_id=qartrealtime000001`) | `cd backend && node ../qa/rbac-matrix.js --cleanup` (hesablar); qalanı brauzerdə UI-nin öz "Sil" düymələri ilə silindi | SİLİNDİ — hamısı sessiya daxilində yaradıldığı kimi UI/skriptlə silindi, SQL ilə yoxlanıb (hesab/kateqoriya/məhsul/masa/promo = 0); sifariş #125 orders cədvəlində CANCELLED olaraq qalır (sifarişlər silinmir, yalnız ləğv edilir — layihənin öz davranışı, E2E testlərinin də #121-124 kimi CANCELLED sifarişləri DB-də qalır) |

## Qərarımı tələb edən / düzəldilməyən məsələlər
- Admin şifrəsi hələ də defoltdur — SAHİB dəyişməlidir (QA dəyişmir).
- `.env` JWT_SECRET zəifdir (secret/12345) — canlıdan əvvəl SAHİB yeni açar yaratmalıdır.
- Qeyd (dəyişdirilmədi, dizayn): `authenticate` rol/versiya vəziyyətini 10 san keşləyir; rol API ilə (OWNER → Komanda) dəyişəndə keş dərhal silinir (təsdiqləndi). DB-də birbaşa dəyişiklik ≤10 san gecikir.
- `NakhidSafarov@gmail.com` YENİ şifrə ilə yaradıldı — istifadəçi bu şifrəni dərhal dəyişməlidir (Hesabım → Şifrəni dəyiş). `google_maps_link`/`tiktok_link`/`instagram_link`/`phone`/`whatsapp` boş buraxıldı — sahib özü doldurmalıdır.

## Sessiya jurnalı (hər sessiya: nə edildi, harada dayandı)
- Sessiya 1 (nöqtə 13, YEKUN): I bitdi — PWA E2E əl ilə keçdi, F27 (`full-flow.spec.js` kövrəkliyi, 56 məhsuldan sonra 90-120san asılı qalırdı) tapıldı və düzəldildi. J bitdi — DEPLOY.md yeniləndi (`DB_POOL_MAX`, masa QR regenerate xatırlatması). Bütün suitlər təmiz: Jest 421, Vitest 212, Playwright 5/5 (+PWA əl ilə). Audit BİTDİ — QA_REPORT.md-də F1–F27 tam, sahibin siyahısı tamdır. İstifadəçiyə Azərbaycan dilində yekun xülasə verildi.
- Sessiya 1 (nöqtə 12): A tam bağlandı (onlayn ödəniş UI, masa QR rejimi, responsiv, F24 `<main>` landmark). F bitdi (F25: indeks çatışmazlığı, miqrasiya 020). G/H bitdi (kod keyfiyyəti təmiz, `npm run build` xəbərdarlıqsız). **K bitdi — ən mühüm tapıntı: F26 (Yüksək), DB bağlantı hovuzu konfiqurasiya edilməyib idi, 25+ paralel sifariş 500 verirdi (30san timeout); `pool.max` təyin edildikdən sonra 50 paralel sifariş 661ms-də hamısı uğurlu.** `qa/loadtest.js` yazıldı (ardıcıl/paralel/qarışıq/yarış/qiymət/real-time/bütövlük). Jest 421 (27 dəst). Backend 4000 yenidən başladıldı, 4001 dayandırıldı.
- Sessiya 1 (nöqtə 11): ⚠ HADİSƏ — `schema.sql`-i sınaq bazasında test edərkən (F22 üçün) faylın daxili `USE qr_menu;` sətri əsl bazanı sıfırladı. İstifadəçiyə dərhal bildirildi. Bərpa: 19 sentyabr backup tapılıb bərpa edildi (istifadəçinin təsdiqi ilə), miqrasiyalar 002→019 əlavə-yönlü tətbiq edildi (sxem tam, 26 cədvəl), menyu məzmunu (19 kateqoriya/56 məhsul/brendinq) `qa/recover-menu-content.js` ilə yenidən yaradıldı, `NakhidSafarov@gmail.com` yeni şifrə ilə bərpa edildi. F22 (QR token seed-də sabit idi) düzəldildi. Jest 419, Vitest 212. A bölməsinin böyük hissəsi brauzerdə sınandı (menyu/filtr/dil/məhsul/səbət/nağd sifariş/izləmə/Sifarişlərim/Sevimlilər) — hamısı işlədi; F23 (FavoriteButton lokallaşdırılmamış aria-label) tapıldı və düzəldildi.
- Sessiya 1 (nöqtə 10): B bitdi (real brauzer, OWNER+MANAGER+WAITER+KITCHEN, 18 səhifə, masaüstü+mobil). Heç bir yeni bug yoxdur, kod dəyişmədi. Bütün müvəqqəti hesab/məlumat silinib (yoxlanıb). Jest 419 (dəyişiklik yoxdur). Backend/frontend serverləri 4000/5174-də işləyir.
- Sessiya 1 (nöqtə 9): D bitdi — `qa/mail-probes.js` (54 yoxlama). F18–F21: giriş limiti IP+e-poçt/IP iki qat (paylaşılan Wi-Fi-da hamını bloklamırdı), `passwordPolicy` (8–128 simvol, yalnız mətn), sıfırlama məktubu limiti yarışı, massiv e-poçt qəbulu. Jest 419 (26 dəst). Backend 4000 yenidən başladıldı, 4001 dayandırıldı.
- Sessiya 1 (nöqtə 8): C bitdi — `qa/payment-probes.js` real DB-də 5 real səhv tapdı: F13 (miqrasiya 019: `order_expired` CHECK pozurdu → vaxtı keçən sifarişlər heç vaxt ləğv olunmurdu), F14 (ləğvdə stok qaytarılmırdı), F15 (ləğv edilmiş sifariş açılırdı), F16 (ödənilmiş onlayn sifariş refund-suz ləğv), F17 (sweeper yarışı). Jest 411, Playwright 5. Backend 4000 yenidən başladıldı (019 tətbiq olunub), 4001 dayandırıldı.
- Sessiya 1 (nöqtə 7): F5 düzəldildi — `securityHeaders.js` (HSTS production-da, Permissions-Policy, API üçün default-src none, HTML üçün hash-li CSP). Real brauzerdə (istehsal build, backend-dən xidmət) menyu+admin+şriftlər+şəkillər+socket+WebSocket CSP pozuntusu olmadan işlədi. Jest 404 (25 dəst). `DEPLOY.md` yeniləndi. Backend 4000 yenidən başladıldı.
- Sessiya 1 (nöqtə 6): dinamik rol matrisi (398 kombinasiya, təmiz) + `qa/probes.js` (injection/fuzz, mass assignment, IDOR, upload, socket). Tapıntılar F9–F13 düzəldildi (giriş hədləri, DB parametr xətaları 400, /health, e-poçt limiterində GET, səbət miqdarı). Jest 397, Vitest 210. Backend (4000) yenidən başladıldı.
- Sessiya 1 (nöqtə 5): npm audit (0/0), git sirr axtarışı (təmiz), F8 zəif JWT_SECRET → secretsCheck (production-da server imtina edir). Jest 387.
- Sessiya 1 (nöqtə 4): F1 (defolt admin şifrəsi bannerı + server xəbərdarlığı; canlı təsdiq: real admin defolt şifrədədir) düzəldildi. Jest 382, Vitest 210. Backend yenidən başladıldı.
- Sessiya 1 (nöqtə 3): F3 (QR tokeni çağırışlarda), F4 (GET /tables rolları), F6 (JWT HS256), F7 (timingSafeEqual) düzəldildi; testlər: Jest 378, Vitest 208. Backend yenidən başladıldı.
- Sessiya 1 (nöqtə 2): F2 CSRF düzəldildi (csrfGuard + 5 test), backend yenidən başladıldı, E2E keçdi. Commit: "QA: CSRF guard".
- Sessiya 1: promptun davamlılıq versiyası yaradıldı; route icazə xəritəsi, cookie/JWT/CORS/SEO/socket kodları oxundu; QA_REPORT.md-də F1–F6 namizədləri yazıldı.
