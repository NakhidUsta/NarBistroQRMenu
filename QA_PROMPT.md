# QA + Təhlükəsizlik auditi promptu (yeni Claude Code sessiyasına yapışdırın)

Sən təcrübəli **senior developer + QA mühəndisi + təhlükəsizlik auditoru**san. Vəzifən: bu layihəni **hər detalına qədər** yoxlamaq, tapdığın **hər səhvi özün düzəltmək**, düzəltmədən sonra testlə təsdiqləmək və sonda hesabat verməkdir. Mənə sual vermə, təsdiq gözləmə — özün qərar ver, davam et. Mənə yalnız **Azərbaycan dilində** yaz.

## 1. Layihə haqqında
- Yer: `C:\Users\Huawei\OneDrive\Desktop\qr-menu` (yalnız bu qovluqda işlə; `savora-restaurant` layihəsinə TOXUNMA).
- Restoran QR-menyu sistemi: müştəri QR/link ilə menyunu açır, sifariş verir, ödəyir; işçilər admin paneldən idarə edir.
- **Backend:** Node/Express (route → controller → service → repository), SQL Server (`qr_menu`), Socket.io, JWT (15 dəq access + rotasiya edən refresh token), Jest+Supertest. Port **4000**.
- **Frontend:** React 19 + Vite + Tailwind v4 + Zustand, Vitest+RTL, Playwright. Port **5174**.
- Rollar: OWNER, MANAGER, WAITER, KITCHEN. Dillər: AZ/EN/RU. PWA, offline sifariş növbəsi, real-time (socket).
- Ödəniş: NAĞD / KARTLA MASADA / ONLAYN (Epoint adapteri + `PAYMENT_PROVIDER=test` saxta rejim). Geri qaytarma, vaxtı keçmiş sifariş təmizləyicisi.
- E-poçt: Gmail SMTP, "şifrəni unutdum", e-poçt dəyişmə, admin paneldə Gmail ayarı (şifrələnmiş saxlanılır).
- README.md və DEPLOY.md-ni əvvəlcə oxu.

## 2. İşləmə qaydaları (MÜTLƏQ)
- **Mövcud məlumatı qoru:** DB-dəki kateqoriya/məhsul/sifarişləri, restoran ayarlarını SİLMƏ. Xüsusilə telefon `+994508263979` olan real sifarişə toxunma. Test üçün yaratdığın hər şeyi (sifariş, məhsul, hesab, fayl) işin sonunda **sil**.
- **Admin şifrəsini dəyişmə, mənim hesabımı silmə.** Giriş lazımdırsa DB-də müvəqqəti OWNER hesabı yarat (bcryptjs hash), işin sonunda həmin hesabı və onun `audit_logs` qeydlərini sil.
- **Gizli məlumat:** `backend/.env`-i git-ə commit etmə, məzmununu çıxışa yazma. Açarları/şifrələri heç yerdə çap etmə.
- **Git:** yalnız yerli commit (mənasız kiçik commit-lər əvəzinə məntiqi qruplarla). `git push` ETMƏ.
- **Real pul/xarici xidmət:** real Epoint/Gmail çağırışı etmə (saxta açarlarla rədd cavabı almaq olar). Real e-poçt göndərmə.
- **Mühit:** Windows. Shell heredoc-da backtick/`${}` problem çıxarır — mürəkkəb skriptləri fayla yazıb `node` ilə işlət. `sqlcmd -S localhost -E -C -I -f 65001 -d qr_menu` (`orders` cədvəlinə DML üçün `-I` mütləqdir). Backend-də dəyişiklikdən sonra 4000 portundakı prosesi dayandırıb `node src/server.js`-i yenidən işə sal (nodemon yoxdur). Vite dev server 5174-dədir.
- Hər düzəlişdən sonra əlaqəli testləri, dəyişiklik böyükdürsə **bütün** dəstləri işlət: `cd backend && npm test`, `cd frontend && npm test`, `cd frontend && npx playwright test` (PWA testi `E2E_PROD=1` + `vite preview` tələb edir — atlanır).
- Yalnız simptomu yox, **kök səbəbi** düzəlt. Mövcud kodun üslubuna (şərh sıxlığı, adlandırma, Azərbaycan dilində mesajlar) uy.
- Səhv düzəldəndə **regressiya testi** yaz (əvvəl uğursuz olub düzəlişdən sonra keçməli). Test boşluqlarını da doldur.
- Şübhəli, amma "dizayn qərarı" ola biləcək şeyi dəyişməzdən əvvəl kodda/README-də niyə belə olduğunu yoxla; əsassız dəyişmə.

## 3. Proses
1. Layihəni oxu, serverləri qaldır, mövcud testləri işlət — **başlanğıc vəziyyəti** qeyd et.
2. Aşağıdakı bölmələri **ayrı-ayrı** yoxla (A → K). Hər bölmədə: yoxla → səhv tap → reproduksiya et → kök səbəbi tap → düzəlt → test yaz → dəstləri işlət.
3. Real brauzerdə yoxla (Playwright və ya daxili brauzer): masaüstü (1280), planşet (768), telefon (375) enlərində. Konsol xətalarına, şəbəkə xətalarına, layout pozulmalarına bax.
4. `QA_REPORT.md` yarat və işləyərkən doldur: tapıntı | ciddilik (Kritik/Yüksək/Orta/Aşağı) | harada | necə reproduksiya olunur | düzəliş | test.
5. Sonda: bütün test dəstləri yaşıl, temp məlumat silinib, commit-lər hazır, hesabatda **düzəltmədiyin/qərarımı tələb edən** məsələlər ayrıca siyahıdadır.

## 4. Yoxlama bölmələri

### A. Müştəri saytı (ictimai, admin paneldən AYRI yoxla)
- Menyu: kateqoriya tab-ları (səhifələmə: telefon 8/planşet 4/kompüter 6), məhsul səhifələməsi (12/səhifə), URL-də `?cat=&q=&page=` saxlanması və məhsuldan geri qayıdış, axtarış (ad/təsvir/kateqoriya/tərkib, az hərfləri: İ/ı/ə), allergen filtri, "Bitib"/gizli məhsul davranışı.
- Məhsul səhifəsi: qalereya, tərkib/allergen, birbaşa link ilə açılış (hook sırası xətası olmamalı), qeyri-mövcud məhsul.
- Səbət/sifariş: miqdar dəyişmə, qiymət dəyişikliyi (409 PRICE_CHANGED axını), promo kod, ƏDV/servis/çatdırılma hesabı, mövcud olmayan məhsul, stok bitməsi, **üç ödəniş üsulu**, onlayn ödəniş axını (saxta provayder: rədd → yenidən cəhd → uğurlu), oflayn növbə (outbox) və idempotentlik (qoşa klik, təkrar sorğu).
- Sifariş səhifəsi: status real-time yenilənməsi, ödəniş paneli (paid/pending/failed/refunded/unpaid/expired), `?pay=success` saxta parametrinin heç nə sübut etməməsi, başqasının sifarişinə token olmadan çıxış (404).
- Masa məntiqi: QR ilə (`?table=&t=`) masa görünür və "Ofisiant çağır/Hesab istə" işləyir; adi linklə (yeni tab) masa YOXDUR; yanlış/köhnə QR token; masasız sifariş icazəsi.
- Sevimlilər, Sifarişlərim, dil dəyişmə (AZ/EN/RU — bütün mətnlər tərcümə olunub?), açılış (splash) ekranı, telefonda sabit alt naviqasiya, kompüterdə yuxarı başlıq, Roman serif şrift, loqo/hero/banner, 404 səhifəsi, ErrorBoundary.
- PWA/offline: manifest, service worker, oflayn menyu, oflayn banner; SEO: title/meta/OG/JSON-LD/sitemap/robots; əlçatanlıq (klaviatura, aria, kontrast, fokus, `alt`); performans (şəkil ölçüləri/lazy, bundle ölçüsü, lazımsız render).

### B. Admin panel (müştəri saytından AYRI yoxla, hər ROL ilə)
- Giriş/çıxış, sessiyalar, token yenilənməsi, bloklanma (5 uğursuz cəhd), "cihazlar" siyahısı, hər yerdən çıxış.
- **Rol matrisi:** hər səhifə və hər API endpoint-i üçün 4 rolla yoxla — icazəsiz rol həm UI-da, həm API-də (403) bağlı olmalıdır. UI gizlətməsi təhlükəsizlik deyil, backend yoxlamalıdır.
- Dashboard (gəlir yalnız ödənilmiş/etibarlı sifarişləri saymalıdır), Sifarişlər (filtr, axtarış, kursor səhifələmə, status axını, "Nağd/Kart alındı", "Pulu geri qaytar", təsdiqlənməyən onlayn sifarişdə yalnız ləğv), Mətbəx ekranı (KDS), Menyu/Kateqoriya/Tərkib/Media (yükləmə, kəsmə, variantlar), Masalar/QR (regenerasiya, yükləmə), Promosyonlar, Stok, Müştərilər, Rəylər (moderasiya), Hesabatlar (CSV ixracı — formula inyeksiyası), İşçilər (yaratma/redaktə/silmə, son OWNER qorunması), Audit Log (səhifələmə, məzmun), Ayarlar (tema/şrift, ödəniş üsulları, **Gmail bölməsi** — yanlış App Password saxlanmır, şifrə geri qaytarılmır, yalnız OWNER), Hesabım (şifrə dəyiş, e-poçtu dəyiş, sessiyalar), Bildirişlər səhifəsi + səs ayarları + real-time.
- Admin siyahılarında səhifələmə (Menyu/Kateqoriyalar), boş vəziyyətlər, xəta vəziyyətləri, yavaş şəbəkə, ikiqat klik, formaların validasiyası.

### C. Ödəniş sistemi
- `paymentService`/`epoint` adapteri: imza (sha1(private+data+private), base64), callback imza yoxlaması, məbləğ uyğunluğu, idempotentlik, təkrar callback, ləğv olunmuş sifarişə gecikmiş ödəniş, `verify` yolunda məbləğsiz "uğurlu" cavabın rədd edilməsi, geri qaytarma (ikiqat klik, provayder rədd edəndə geri alma), vaxtı keçmiş sifarişin təmizlənməsi + stokun qaytarılması, valyuta yalnız AZN.
- **Brauzerə etibar edilmir:** müştəridən gələn `total/price/status/payment_status/paid_*` sahələri nəzərə alınmamalıdır; məbləğ yalnız serverdə DB-dən hesablanır.
- Hesabatlar/dashboard PENDING/FAILED/REFUNDED onlayn sifarişləri gəlirə daxil etməməlidir.
- `npm run payment:check` və `npm run payment:simulate` skriptlərinin düzgün işləməsi.

### D. E-poçt / şifrə bərpası
- Forgot → link (30 dəq, birdəfəlik, hash saxlanır), hesab enumerasiyası yoxdur (eyni cavab + vaxt fərqi yoxdur), saatda 3 məktub limiti, reset-dən sonra bütün sessiyalar bağlanır, zəif şifrə linki yandırmır, link Host başlığından yox `PUBLIC_URL`-dən qurulur, e-poçt dəyişmə (cari şifrə tələb edir, köhnə linkləri ləğv edir), SMTP xətaları dostcasına mesajla, Gmail ayarı `mail_settings` (AES-256-GCM, `JWT_SECRET`-dən açar).

### E. TƏHLÜKƏSİZLİK auditi (OWASP Top 10 əsasında, kod + dinamik test)
- **AuthN/AuthZ:** hər route-da `requireAdmin`/`authorize`; IDOR (başqasının sifarişi/tokeni/ödənişi, `order:<id>` socket otağı); JWT/cookie bayraqları (httpOnly, sameSite, secure production-da, path), token rotasiyası və reuse aşkarı, parol hash (bcrypt), brute-force, sessiya sabitləşməsi.
- **CSRF/CORS:** cookie ilə autentifikasiya olan state-dəyişən sorğular; `CLIENT_ORIGIN`, credentials; callback endpoint-i.
- **Injection:** bütün SQL sorğuları parametrlidirmi (xüsusilə `IN (...)` ilə yığılanlar, `LIKE`, `ORDER BY`); XSS (React `dangerouslySetInnerHTML`, e-poçt şablonları, SEO-nun `<head>`-ə yeritdiyi JSON-LD/OG, tema/hero mətnləri); CSV formula inyeksiyası; log/header injection; SSRF/open redirect (ödəniş yönləndirmələri).
- **Fayl yükləmə:** bayt-imza (magic bytes) yoxlaması, ölçü limiti, ad/yol traversal, təhlükəli tiplər (SVG/HTML), `uploads` təqdimi başlıqları.
- **Mass assignment / kütləvi sahə:** update endpoint-lərində istənilməyən sahələrin (role, restaurant_id, status, payment_status) yazılması.
- **Rate limiting və DoS:** ictimai endpoint-lər (sifariş, quote, scan, callback), səhifələmə limitləri, böyük gövdə, socket flood.
- **Məlumat sızması:** xəta mesajlarında stack/SQL detalı, `access_token`-un siyahılarda/sockets-də sızması, şəxsi məlumatın (telefon/ad) müştəri otaqlarına yayımı, loglarda PII və sirlər, `/api/restaurant`-da həssas sahələr, `.env`/açarların git tarixçəsində olması.
- **Başlıqlar/transport:** CSP, X-Frame-Options, nosniff, Referrer-Policy, HSTS (production), `trust proxy`, cookie `secure`.
- **Yarış halları:** stok azaltma, promo istifadə limiti, ikiqat ödəniş/geri qaytarma, eyni `client_request_id`.
- **Asılılıqlar:** `npm audit` (backend+frontend), köhnəlmiş/təhlükəli paketlər; lazımsız asılılıqlar.
- **Socket.io:** `/admin` namespace autentifikasiyası, otaq icazələri, event dedupe/ack, yeniden qoşulma.

### F. Verilənlər bazası və məlumat bütövlüyü
- Sxem (`schema.sql`) ilə migrasiyaların (001–018) uyğunluğu; `schema.sql`-in sıfır DB-də xətasız işləməsi (müvəqqəti ayrı DB-də sına, sonra sil); məhdudiyyətlər/FK/indekslər; tranzaksiyalar (sifariş yaratma, ödəniş, geri qaytarma); cascade davranışları; vaxt zonası (TZ) və hesabat tarixləri.

### G. Backend keyfiyyəti
- Xəta idarəetməsi (mərkəzi handler), validasiya boşluqları, asinxron xətalar, `unhandledRejection`, sızan bağlantılar, yavaş sorğular (N+1, indeks), qeyri-lazımlı `SELECT *`, kod təkrarı, ölü kod, konfiqurasiya defoltları.

### H. Frontend keyfiyyəti
- React qaydaları (hook sırası, effekt asılılıqları, yaddaş sızıntısı: socket/interval/listener), state uyğunsuzluğu, race condition-lar (sürətli naviqasiya), formaların davranışı, i18n boşluqları (tərcümə olunmamış sətirlər), aria/klaviatura, konsol xəbərdarlıqları, bundle ölçüsü, lazy-load.

### I. Testlər
- Mövcud dəstlərin hamısını işlət; uğursuz/yavaş/qeyri-sabit (flaky) testləri düzəlt; yuxarıdakı hər tapıntı üçün test əlavə et; əhatə edilməyən kritik yolları (ödəniş, RBAC, sifariş yaratma) müəyyənləşdirib testlə doldur. Test sonrası DB-də test məlumatı qalmamalıdır.

### J. Canlıya hazırlıq (deploy)
- Production build (`vite build`) və backend-in `dist`-i təqdim etməsi, SEO injection; `.env.example`-ın tamlığı (bütün dəyişənlər sənədləşib?); `NODE_ENV=production` davranışları (test ödəniş provayderi söndürülür, secure cookie, `trust proxy`); `DEPLOY.md` addımlarının doğruluğu; backup skripti; jurnal qovluğu; defolt admin şifrəsi/`JWT_SECRET` xəbərdarlığı; HTTPS tələbi; `PUBLIC_URL` olmadıqda e-poçt/ödəniş linklərinin `localhost`-a getməsi barədə xəbərdarlıq.

### K. YÜK və dözümlülük testi — 300 sifariş (sayt çökür, yavaşlayır, məlumat pozulur?)
Məqsəd: sistemin real yük altında **çökmədiyini, məlumatı pozmadığını və yavaşlamadığını** sübut etmək. Yalnız **lokal** DB və backend üzərində işlə (heç vaxt production-a qarşı yox), ödəniş üçün `PAYMENT_PROVIDER=test`.

**Hazırlıq.** Node skripti yaz (fayla, `node` ilə işlət; `fetch` + Promise hovuzu). Bütün test sifarişlərini tanımaq üçün **işarə** qoy: `customer_name` = `LOADTEST-<nömrə>`, telefon = `+99400000<5 rəqəm>` (real telefonlarla qarışmasın). `backend/src/config/db.js`-də bağlantı hovuzunun (pool) ölçüsünə və `app.js`-dəki rate limit-lərə bax, test nəticəsini onlarla əlaqələndir.

**Mərhələlər** (hər mərhələdə vaxtı, status kodlarının bölgüsünü, gecikməni p50/p95/p99, backend prosesinin yaddaş (RSS) və CPU-sunu əvvəl/sonra ölç):
1. **300 ardıcıl sifariş** (baza xətti).
2. **300 paralel sifariş**, paralellik 10 → 25 → 50 (bir restoran Wi-Fi-ı = bir IP). Ümumi rate limit-in (defolt 3000/15 dəq/IP) bu yükü qəbul edib-etmədiyini müşahidə et; 429 çıxırsa, bunun real restoran üçün yetərli olub-olmadığını qiymətləndir (test üçün RATE_LIMIT_GENERAL artırmaq olar, amma production defoltunu əsassız dəyişmə).
3. **Qarışıq ssenari** (300 sifarişin içində): NAĞD / KARTLA MASADA / ONLAYN (saxta provayderlə `/pay/test` tamamlama, bir hissəsi rədd), masa ilə və masasız, promo kodlu, `quote` sorğuları, sifariş statusu dəyişmələri, bildiriş yaranması.
4. **Yarış halları:** (a) stok izlənən məhsuldan stok N ikən paralel N+20 sifariş → **tam N uğurlu**, stok heç vaxt mənfi olmamalı; (b) eyni `client_request_id` ilə **eyni anda** təkrar göndərmə (offline növbə/qoşa klik) → yalnız **bir** sifariş; (c) limitli promo kodun paralel istifadəsi limiti aşmamalı; (d) eyni sifarişə paralel iki ödəniş callback-i/geri qaytarma → bir dəfə tətbiq olunmalı.
5. **Qiymət manipulyasiyası** yük altında: brauzerdən gələn `total/price/status/payment_status` göndərən sorğular → hamısı serverdə düzəldilməli/rədd edilməli.
6. **Real-time:** 300 sifariş gedərkən 2-3 admin socket-i və KDS açıq olsun → hər `order-created` hadisəsi hər birinə **itmədən və təkrarlanmadan** çatmalı; bağlantı qopub-qoşulanda (recovery) sifariş itməməli.
7. **Yükdən sonra admin panel və müştəri saytı:** 300+ sifarişlə Sifarişlər siyahısı (kursor səhifələmə, "daha köhnələri göstər"), Mətbəx ekranı (render sürəti, brauzer donması), Dashboard və Hesabat sorğularının vaxtı, CSV ixracı, bildirişlər səhifəsi (səhifələmə), müştəri menyusu — yavaşlıq və konsol xətaları yoxlanmalı.

**Bütövlük yoxlaması (yükdən sonra, SQL ilə):** yaradılan sifariş sayı = uğurlu HTTP cavabların sayı; `client_request_id` üzrə dublikat yoxdur; hər sifarişin `total` = `order_items` cəmi + haqlar (yenidən hesabla); `payment_status`/`payments` uyğunluğu (PAID ↔ SUCCESS cəhd, PENDING onlayn sifarişlər admin/mətbəxə düşməyib); stok mənfi deyil və `stock_movements` ilə uyğundur; heç bir yetim sətir (order_items/payments/notifications) yoxdur; backend jurnalında gözlənilməz xəta/unhandledRejection yoxdur; proses çökməyib və hovuz tükənməyib.

**Qəbul meyarı:** gözlənilməz 5xx = 0; proses çökmür; yaddaş yük bitəndən sonra sabitləşir (davamlı artım yoxdur); paralellik 25-də p95 gecikmə məntiqi həddədir (~1 san və ya səbəbi izah olunub); itmiş/təkrarlanmış sifariş yoxdur; bütövlük yoxlamaları keçir. Meyar pozularsa **darboğazı tap** (yavaş sorğu/indeks, N+1, hovuz ölçüsü, event-loop bloklanması, tranzaksiya kilidi, socket yayımı), düzəlt, testi yenidən işlət və **əvvəl/sonra** rəqəmləri hesabata yaz.

**Təmizlik (MÜTLƏQ):** yükdən sonra bütün `LOADTEST-` sifarişlərini və onlara bağlı sətirləri (order_items, order_status_history, payments, notifications, stock_movements, promo istifadə qeydləri) sil; sifarişlərlə azalmış stoku və promo sayğacını **əvvəlki dəyərinə qaytar**; `sqlcmd`-də `-I` bayrağını unutma; sonda real sifarişin (+994508263979), məhsul/kateqoriya sayının və restoran ayarlarının **toxunulmaz** qaldığını sayla yoxla.

## 5. Yekun təhvil
- `QA_REPORT.md`: ümumi xülasə, ciddiliyə görə tapıntılar cədvəli (düzəldilənlər və düzəldilməyənlər), test nəticələri (əvvəl/sonra sayları), yük testinin rəqəmləri (K bölməsi: uğur %, gecikmə p50/p95/p99, yaddaş, tapılan darboğazlar), qalan risklər, canlıya çıxmazdan əvvəl **mənim** etməli olduqlarım (domen, Epoint açarları, Gmail App Password, `.env` sirləri).
- Bütün dəyişikliklər yerli git commit-lərində; iş qovluğu təmiz; müvəqqəti fayl/hesab/məlumat silinib; serverlər (4000, 5174) işləyir vəziyyətdə qalıb.
- Sonda mənə Azərbaycan dilində **qısa** yekun yaz: neçə səhv tapdın, neçəsini düzəltdin, nə qaldı, mənim növbəti addımlarım.
