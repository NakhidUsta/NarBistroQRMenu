# QR Menu

Restoran üçün QR-kod əsaslı rəqəmsal menyu sistemi — React (Vite) + Tailwind + Zustand frontend, Node.js/Express backend (Clean Architecture: route → controller → service → repository), SQL Server, Socket.io ilə real-time sinxronizasiya.

Admin panel sistemin **tək idarəetmə mərkəzidir**: məhsul, kateqoriya, masa/QR, promo, stok, restoran məlumatları, dizayn (rəng/font/hero/banner/footer) və işçilər kodu dəyişmədən idarə olunur; dəyişikliklər açıq müştəri ekranlarına refresh olmadan yayılır.

## Quraşdırma

### 1. Verilənlər bazası

SQL Server-də boş `qr_menu` bazası yaradın, sonra sxemi tətbiq edin:

```bash
sqlcmd -S localhost -E -C -f 65001 -d qr_menu -i backend/database/schema.sql
```

`-f 65001` mütləqdir — olmasa Azərbaycan hərfləri (ə, ş, ğ...) korlanmış yazılır.

Seed: 1 restoran, 1 OWNER (`admin@qrmenu.local` / `ChangeMe123!` — **production-da mütləq dəyişdirin**), kateqoriyalar, məhsullar, 3 masa, `XOSGEL10` promo kodu.

Mövcud bazanı yeniləmək üçün `backend/database/migrations/` fayllarını nömrə ardıcıllığı ilə tətbiq edin (002 promo/inventory, 003 i18n, 004 theme, 005 fees, 006 reviews, 007 session security, 008 media, 009 qalereya + allergenlər, 010 tərkib kataloqu, 011 sifariş idempotency, 012 bildiriş statusu, 013 sessiyalar/refresh token, 014 məhsul görünürlüyü, 015 favicon, 016 e-poçt tokenləri).

> Əl ilə `sqlcmd` ilə `orders` cədvəlinə yazı/silmə əməliyyatı edirsinizsə `-I` bayrağı mütləqdir (filtrli unikal indeks `QUOTED_IDENTIFIER ON` tələb edir): `sqlcmd -S localhost -E -I -f 65001 -d qr_menu -Q "..."`. Tətbiqin öz bağlantısı bunu avtomatik edir.

### 2. Backend

```bash
cd backend
npm install
cp .env.example .env   # DB_USER/DB_PASSWORD/JWT_SECRET/TZ_OFFSET_HOURS dəyərlərini doldurun
npm run dev
```

`http://localhost:4000` — `/api/health` DB bağlantısını, gecikməni və uptime-ı göstərir.

### 3. Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

- Müştəri menyusu: `http://localhost:5174/menyu` (masa QR-ı: `?table=<code>&t=<token>`)
- Admin panel: `http://localhost:5174/admin/login`
- Mətbəx ekranı (KDS): `http://localhost:5174/kitchen`

## Təhlükəsizlik və əməliyyat

- **Sessiya (access + refresh token):** qısa ömürlü access token (defolt 15 dəq, `ACCESS_TOKEN_MINUTES`) və **hər yenilənmədə rotasiya olunan** refresh token (httpOnly cookie, yalnız `/api/auth` yoluna göndərilir, DB-də yalnız SHA-256 hash-i). Panel açıq olduqca səssiz yenilənir (401 alanda avtomatik refresh + sorğunun təkrarı). Refresh 12 saat fəaliyyətsiz qalanda (`ADMIN_SESSION_HOURS`) və ən çox 7 gün (`ADMIN_SESSION_MAX_DAYS`) sonra bitir. **Oğurluq aşkarı:** artıq istifadə olunmuş refresh token (10 saniyəlik paralel-tab pəncərəsindən sonra) təkrar təqdim edilsə həmin cihazın bütün sessiyası bağlanır. Hər sorğuda DB-də sessiya, token versiyası və **cari rol** yoxlanılır. **Hesabım** səhifəsində aktiv cihazlar siyahısı var: tək cihazı bağlamaq (o cihazın socket-ləri də kəsilir), "Bütün cihazlardan çıxış" və şifrə dəyişəndə digər cihazların bağlanması.
- **Giriş qorunması:** IP üzrə 5 uğursuz cəhd / 15 dəq limiti + hesab üzrə 5 uğursuz cəhddən sonra 15 dəqiqəlik bloklama; bcrypt hash; cavab vaxtı ilə istifadəçi adı aşkar olmur.
- **Şifrəni unutdunuz:** Gmail qoşulubsa girişdə **"Şifrəni unutdunuz?"** linki görünür (aşağıda "E-poçt / Gmail"). Qoşulmayıbsa OWNER işçi şifrəsini **İşçilər** səhifəsindən dəyişə bilər; OWNER özü unudubsa server maşınında:
  ```bash
  cd backend && npm run reset-password -- admin@qrmenu.local YeniSifre123
  ```
  Bütün köhnə sessiyalar bağlanır və hesab bloku götürülür.
- **DB backup:** `cd backend && npm run backup` — sıxılmış, CHECKSUM ilə tam backup (`BACKUP_DIR`, defolt SQL Server-in backup qovluğu), 14 gündən köhnələri silinir. Gündəlik işə salmaq üçün (Windows):
  ```bash
  schtasks /Create /SC DAILY /ST 03:00 /TN "QRMenuBackup" /TR "cmd /c cd /d C:\path\to\qr-menu\backend && npm run backup"
  ```
  Bərpanı sınayın: `RESTORE VERIFYONLY FROM DISK = N'...bak' WITH CHECKSUM` (sysadmin ilə).
- **Xəta jurnalı və xəbərdarlıq:** gözlənilməz server xətaları `backend/logs/error-YYYY-MM-DD.log`-a (JSON sətirləri, stack trace yalnız orada — istifadəçiyə heç vaxt) yazılır və sahib/menecerə admin paneldə "Sistem xətası" bildirişi gedir (eyni xəta 10 dəq-də bir). Arxa plan monitoru DB-nin ardıcıl 2 yoxlamada cavab verməməsini xəbər verir (DB çöküb bildiriş yazıla bilmirsə canlı, yazılmamış xəbərdarlıq göndərilir). Yanlış JSON kimi müştəri xətaları 4xx qaytarır, xəbərdarlıq yaratmır.
- **Monitorinq:** `/api/health` (DB gecikməsi, uptime), 1 saniyədən yavaş API sorğuları konsola `[YAVAŞ]` kimi yazılır, bütün admin dəyişiklikləri **Audit Log**-da.
- **HTTPS:** deploy zamanı reverse proxy (nginx/Cloudflare) ilə; `NODE_ENV=production` olanda cookie `secure`+`SameSite=None` və `trust proxy` aktiv olur.

## Rollar

| Rol | Giriş |
|---|---|
| OWNER | hamısı (işçilər, audit log daxil) |
| MANAGER | menyu, kateqoriya, masa, promo, dashboard, audit, ayarlar, sifarişlər |
| WAITER | sifarişlər, çağırış/hesab bildirişləri, masalar |
| KITCHEN | yalnız sifarişlər və `/kitchen` |

İcazələr **backend middleware** (`authorize(...)`) ilə tətbiq olunur; frontend guard yalnız UX üçündür.

## Testlər

```bash
cd backend  && npm test            # Jest + Supertest (DB-siz: API icazələri, validasiya, servis məntiqi, real Socket.io serveri ilə inteqrasiya)
cd frontend && npm test            # Vitest + React Testing Library
cd frontend && npx playwright test # E2E — backend (:4000) və frontend (:5174) işləyərkən, real DB üzərində
```

E2E, PDF-in 23 addımlı ssenarisini icra edir (admin məhsul yaradır → müştəri refresh-siz görür → sifariş → status → "bitib" → qiymət → ümumi `/menyu` linki). Test öz məhsulunu silir, sifarişi ləğv edir.

## PWA / SEO

- `public/manifest.webmanifest`, `public/sw.js` (menyu API-si network-first, şəkillər stale-while-revalidate, offline səhifə), ikonlar `public/icons/`. Service worker yalnız **production build**-də (`npm run build && npm run preview`) qeydiyyatdan keçir.
- **Dinamik SEO/OG:** `npm run build` (frontend) sonrası backend `frontend/dist`-i özü təqdim edir (`FRONTEND_DIST` ilə dəyişmək olar) və hər səhifənin `<head>`-inə DB-dən restoran/məhsul üzrə OG, Twitter, canonical və JSON-LD (Restaurant / MenuItem) yeridir. `/sitemap.xml` məhsullardan avtomatik yaranır, `/robots.txt` real domeni yazır. Admin/səbət/sifariş səhifələri `noindex` alır. Domen üçün backend `.env`-də `PUBLIC_URL=https://menu.example.az` qoyun (yoxdursa Host başlığından alınır); frontend build-də `VITE_API_URL`-i real API ünvanına təyin edin. Dev rejimində (Vite) bu işləmir — yalnız production-da.
- **Paylaş:** məhsul səhifəsində və menyunun altında "Paylaş" düyməsi — mobildə sistem paylaşım pəncərəsi (Instagram/WhatsApp orada seçilir), digər yerdə link kopyalanır. Paylaşılan link masa kodu daşımır.

## Media kitabxanası

Admin → **Media** (OWNER/MANAGER). Hər yüklənən şəkil (`POST /api/upload`, bayt-imza yoxlaması ilə) `media` cədvəlinə yazılır və `backend/uploads/`-də saxlanılır:

- orijinal (EXIF/GPS silinmiş, `m-<vaxt>-<hex>.<ext>`) + **thumb 240px / md 640px / lg 1280px** WebP və **md/lg AVIF** variantları (kiçik şəkil böyüdülmür);
- **kəsmə** (`POST /api/media/:id/crop`, nisbət `1:1 | 4:3 | 16:9`, fokus `attention | centre`) orijinalı saxlayıb yeni şəkil yaradır;
- **silmə** — istifadədə olan (məhsul/tema şəkli) şəkil üçün `409`; silinəndə bütün variantlar da silinir;
- məhsul/tema formalarında “Kitabxanadan seç” ilə əsas şəkil seçilir; müştəri UI-ı `<picture>` (AVIF → WebP → orijinal) və `srcset` istifadə edir. Köhnə yükləmələr və xarici URL-lər olduğu kimi göstərilir.

## E-poçt / Gmail (şifrə sıfırlama və e-poçt təsdiqi)

> Qurulumu terminaldan yoxlamaq üçün: `cd backend && npm run mail:test -- sizin@gmail.com` (`.env`-dəki `SMTP_USER`/`SMTP_PASS` ilə sınaq məktubu göndərir və səhv olarsa səbəbini yazır).

Sistem məktubları **Gmail SMTP** ilə göndərir. Gmail adi şifrə qəbul etmir — 16 simvollu **Tətbiq şifrəsi** (App Password) lazımdır:

1. Google hesabında **2 addımlı doğrulamanı** aktiv edin (Təhlükəsizlik bölməsi) — bunsuz Tətbiq şifrəsi yaradıla bilmir.
2. https://myaccount.google.com/apppasswords → ad verin (məs. "QR Menu") → **Yarat**. Google 16 simvollu şifrə göstərir (boşluqlar olsa da olar).
3. `backend/.env` faylına yazın (**bu şifrəni heç kimə göndərməyin, git-ə qoymayın** — `.env` artıq `.gitignore`-dadır):
   ```ini
   SMTP_USER=restoran@gmail.com
   SMTP_PASS=abcd efgh ijkl mnop
   # MAIL_FROM="Savora <restoran@gmail.com>"   # istəyə bağlı (Gmail göndərən ünvanı öz hesabınıza çevirə bilər)
   PUBLIC_URL=https://menu.example.az          # linklər bu ünvanla qurulur (local-da CLIENT_ORIGIN istifadə olunur)
   ```
4. Backend-i yenidən başladın. Admin → **Hesabım → "Sınaq məktubu göndər (SMTP yoxla)"** (yalnız OWNER) — Gmail ayarlarını yoxlayır; səhv olsa səbəbi (məs. "Tətbiq şifrəsi olmalıdır") göstərilir.

Necə işləyir:
- **Şifrə sıfırlama:** giriş → "Şifrəni unutdunuz?" → e-poçt → məktubdakı link (**30 dəq, yalnız 1 dəfə**) → yeni şifrə. Sıfırlanandan sonra bütün cihazlardan çıxış edilir, hesab bloku götürülür, e-poçt təsdiqlənmiş sayılır.
- **E-poçt təsdiqi:** Hesabım → "Təsdiq məktubu göndər" (link 24 saat, 1 dəfə).
- **Təhlükəsizlik:** tokenlər 256 bitdir, DB-də yalnız SHA-256 hash-i; hər hesabda eyni anda bir etibarlı link; saatda ən çox 3 məktub/hesab, 15 dəqiqədə 10 sorğu/IP; "unutdum" sorğusu hesabın mövcudluğunu **açmır** (həmişə eyni cavab, məktub arxa planda göndərilir — vaxt fərqi də yoxdur); link Host başlığından yox, `PUBLIC_URL`-dən qurulur. SMTP qurulmayıbsa "Şifrəni unutdunuz?" görünmür, heç nə çökmür.
- Gmail-in gündəlik limiti (adi hesab ~500 məktub) bu istifadə üçün kifayətdir. Yalnız **dev** üçün `MAIL_DRIVER=console` — məktub göndərilmir, mətni (tokenli link daxil) konsola yazılır; production-da işlətməyin.

## Real-time etibarlılığı, offline və sifariş təhlükəsizliyi

- **Socket:** hər hadisə unikal `_eid` daşıyır (klient təkrar hadisəni atır); sifariş/bildiriş hadisələri `_ack` daşıyır və klient `event-ack` göndərir — təsdiq alınmayanlar `/api/health → sockets.missing_ack` və jurnalda görünür. Eksponensial geri çəkilmə (1s→30s + jitter, sonsuz cəhd), heartbeat (ping 25s/timeout 20s), 2 dəq-ə qədər kəsilmələrdə itirilmiş hadisələrin və otaq üzvlüyünün bərpası (admin-də JWT orta qatı bərpada da işləyir). Bərpa olunmayıbsa klient menyu/sifarişləri/bildirişləri serverdən səssiz yenidən yükləyir.
- **Sifariş otaqları:** müştəri `order:<id>` otağına yalnız sifarişin gizli tokenini bildirəndə qoşulur; müştəri otaqlarına gedən hadisələrdə yalnız `id` və `status` var (telefon, ad, token, qeyd yox).
- **Offline sifariş növbəsi:** internet yoxdursa (və ya sorğu şəbəkədə kəsilibsə) sifariş cihazda saxlanılır və bağlantı qayıdanda avtomatik göndərilir. Hər sifarişin `client_request_id`-si var — backend eyni ID-ni təkrar qəbul etsə ikinci sifariş yaratmır (idempotency; telefon uyğun gəlməlidir). "Sifarişlərim"də gözləyən/rədd edilən sifarişlər görünür. GET sorğuları şəbəkə xətasında 2 dəfə təkrar cəhd olunur.
- **Qiymət dəyişikliyi:** klient gördüyü məbləği (`expected_total`) göndərir; backend cari məbləğlə fərqlənirsə sifariş yaratmır, `409 PRICE_CHANGED` (köhnə/yeni məbləğ) qaytarır — müştəri "Qiymət dəyişib" dialoqunda yeni məbləği təsdiqləyir.
- **Call Waiter / Request Bill:** admin bildiriş mərkəzində `Gözləyir → Qəbul edildi → Həll edildi` (kim qəbul etdi göstərilir, digər adminlərdə canlı yenilənir); masada həll olunmamış eyni sorğu təkrar yaranmır. Yeni bildiriş növləri: **Məhsul bitib** (stok 0 və ya əl ilə "Bitib"), **Stok azalır**, **Sistem xətası** (yalnız sahib/menecerə).
- **Siyahılar:** admin paneldə səhifələr lazy-load olunur; sifarişlər və audit log kursor səhifələmə (`?limit=&before=`, `X-Has-More` başlığı) və sonsuz sürüşdürmə ilə, müştəri menyusu və media kitabxanası tədricən göstərilir.
- **Məhsul görünürlüyü:** "Bitib" (`is_available=0`) məhsul menyuda **Bitib** kimi görünür, "Gizli" (`is_visible=0`) isə müştəriyə heç göstərilmir (siyahı, səhifə, sitemap, sifariş). Admin siyahıda "Gizlət/Göstər" düyməsi var.
- **Favicon:** Ayarlar → Favicon; brauzer tabında dinamik dəyişir və server tərəfdə `<head>`-ə yeridilir. **Ümumi link:** `/menu` → `/menyu` (sorğu parametrləri saxlanılır); admində "Instagram-da paylaş" düyməsi (mobildə paylaşım pəncərəsi, digər yerdə kopyalama).

## Məhsul şəkilləri və allergenlər

- **Qalereya:** məhsula 10-a qədər şəkil (`product_images`); admin formasında yüklə / kitabxanadan seç / sırala / sil, birinci şəkil **əsas** şəkildir (`products.image_url` avtomatik ona bərabər olur). Müştəri məhsul səhifəsində sürüşən qalereya (AVIF/WebP) görür. API: `POST/PUT /api/products` gövdəsində `images: [url,…]` (yalnız `/uploads/…` və http(s) linkləri qəbul olunur); verilməzsə mövcud qalereyaya toxunulmur.
- **Allergenlər:** AB-nin 14 standart allergeni (`allergens`, AZ/EN/RU adları + ikon), məhsula `allergen_ids: [1, 7]` ilə bağlanır (`product_allergens`); `GET /api/allergens` açıqdır. Müştəri menyuda "Allergen filteri" ilə qaçınmaq istədiyi allergenləri seçir və onları ehtiva edən yeməklər gizlədilir (seçim cihazda saxlanılır). Köhnə sərbəst mətn sahəsi ("Digər allergen qeydləri") ehtiyat/qeyd üçün qalır — filtr yalnız kataloqdan seçilmiş allergenlərə işləyir, ona görə istifadəçiyə ofisiantla dəqiqləşdirmək tövsiyə olunur.
- **Tərkib kataloqu:** komponentlər (`ingredients`, AZ/EN/RU) məhsula sıralı `ingredient_ids` ilə bağlanır (`product_ingredients`). Admin → **Tərkiblər** səhifəsində ad/tərcümə bir yerdə dəyişir və bütün məhsullarda, açıq müştəri ekranlarında dərhal yenilənir (socket `ingredient-updated`); məhsul formunda axtarışlı seçici var, kataloqda olmayan komponent orada yazılıb dərhal yaradılır. Məhsulda istifadə olunan komponent silinmir (409). Köhnə sərbəst mətn sahələri ehtiyat kimi qalır — mövcud məhsulları kataloqa köçürmək üçün bir dəfə: `cd backend && npm run migrate:ingredients` (`-- --dry-run` ilə öncə baxın). Boş bazadan başlayırsınızsa (`schema.sql`) bunu seed məhsulları üçün də işlədə bilərsiniz.
- **Köhnə şəkilləri kitabxanaya köçürmək:** media kitabxanasından əvvəl yüklənmiş fayllar üçün `npm run media:import` (`-- --dry-run`, `-- --delete-old`) — variantlar yaradır, məhsul/loqo/hero istinadlarını yeni linkə yönləndirir.

## Deploy

Production-a çıxarış (HTTPS, nginx, pm2, backup) — [DEPLOY.md](DEPLOY.md).

## Açılış ekranı, dizayn və bildirişlər

- **Açılış ekranı (intro):** `frontend/index.html`-də saf HTML/CSS ilə hazırdır, yəni link açılan anda — JS yüklənməmişdən — görünür. Restoranın adı/loqosu/rəngləri `localStorage`-də (`qrmenu_brand`) saxlanılır və növbəti girişdə intro artıq restoranın öz brendi ilə açılır. Menyu və restoran məlumatı hazır olanda (min. 0.8 san, max. 8 san) solaraq silinir; xəta olsa da ilişmir (`SplashGate`).
- **Telefon:** Menyu / Sevimlilər / Sifarişlər / Səbət paneli ekranın altında sabitdir və məhsul səhifəsində də görünür (səbət həmişə əlçatandır); "Səbətə əlavə et" paneli onun üstündə dayanır.
- **Kompüter (md+):** həmin naviqasiya yuxarıdakı sticky başlığa (`SiteHeader`: loqo, ad, naviqasiya, dil) keçir; məzmun geniş şəbəkədə (3 sütunlu menyu, 2 sütunlu məhsul və səbət səhifələri) göstərilir.
- **Bildirişlər səhifəsi (`/admin/notifications`, OWNER/MANAGER/WAITER):** tam siyahı (kursor səhifələmə — "Daha köhnələri göstər"), filtrlər, oxu/sil, çağırış üçün [Qəbul et]/[Həll edildi]; yan tərəfdə **səs ayarları** — ümumi açar, həcm, hər bildiriş növü üçün ayrıca siqnal (və ya "Səssiz") və sınaq düyməsi, brauzer bildirişləri. Ayarlar cihazda saxlanılır. Brauzerlər səsi yalnız istifadəçi jestindən sonra açır — panel ilk klikdə səsi avtomatik aktivləşdirir, bloklanıbsa "Səsi aktivləşdir" düyməsi çıxır. Başlıqdakı 🔊/🔇 düyməsi səsi tez söndürür.

- **Səhifələmə:** müştəri menyusunda yeməklər nömrəli səhifələrlə göstərilir (səhifədə 12, ‹ 1 2 3 ›), kateqoriya tab-ları da səhifələnir ("Hamısı" sabit; telefonda 8 (həb düymələri kimi, bir neçə sətirdə), planşetdə 4, kompüterdə 6 kateqoriya). Axtarış/kateqoriya/allergen filtri dəyişəndə 1-ci səhifəyə qayıdır. Kateqoriya, axtarış və səhifə URL-də saxlanılır (`?cat=5&page=2`) — məhsuldan geri qayıdanda eyni görünüş açılır, link paylaşmaq da olur. Admin panelin Menyu və Kateqoriyalar siyahılarında da nömrəli səhifələmə var (10/20/50).

## Ödəniş sistemi

Üç ödəniş üsulu (Admin → Ayarlar → "Ödəniş üsulları"-ndan açılıb-bağlanır): **nağd**, **kartla masada (terminalla)** və **onlayn kart**.

- **Nağd / kartla masada:** sifariş dərhal mətbəxə çatır, ödəniş "Ödənilməyib" görünür. Ofisiant/menecer Sifarişlər səhifəsində **"Nağd alındı" / "Kart alındı"** düyməsi ilə qeyd edir (audit logda saxlanılır, müştərinin açıq səhifəsində real vaxtda "Ödənilib" olur).
- **Onlayn kart (Epoint.az):** müştəri "Ödənişə keç" edir → sifariş yaranır (amma **mətbəxə/adminə hələ çatmır**) → Epoint-in bank kart səhifəsinə yönləndirilir → ödəniş təsdiqlənəndə (server-server callback) sifariş **ilk dəfə indi** mətbəxə və bildirişlərə düşür. Uğursuz olarsa müştəri sifariş səhifəsindən "Yenidən cəhd et" edir. Ödənilməyən onlayn sifariş `PAYMENT_HOLD_MINUTES` (defolt 30) dəqiqədən sonra avtomatik ləğv olunur və stok qaytarılır.
- **Təhlükəsizlik:** kart məlumatları (nömrə/CVV) bizim serverdən keçmir və saxlanılmır (yalnız maskalı nömrə); məbləğ həmişə bazadakı sifarişdən götürülür; callback imzası (`sha1(private+data+private)`) sabit vaxtlı müqayisə ilə yoxlanılır və məbləğ uyğun gəlməsə ödəniş qəbul edilmir; təkrar callback heç nəyi dəyişmir (idempotent); provayderin qaytardığı ödəniş ünvanı yalnız `https://*.epoint.az` ola bilər; URL-dəki `?pay=success` heç nəyi sübut etmir — status həmişə serverdən soruşulur. Açarlar yalnız `.env`-dədir.
- **Epoint qeydiyyatı zamanı 4 ünvan verilir** (Epoint açarları bunları yoxlayandan sonra verir): sayt ünvanı, `success_url` (`<sayt>/payment/success`), `error_url` (`<sayt>/payment/error`) və `result_url` (`<API>/api/payments/epoint/callback`). Onları hazır çap edən əmr: `cd backend && npm run payment:check`.
- **Açarlar gələndən sonra (yalnız `.env`):** `PAYMENT_PROVIDER=epoint`, `EPOINT_PUBLIC_KEY`, `EPOINT_PRIVATE_KEY`, `PUBLIC_URL`, `API_PUBLIC_URL` → serveri yenidən başladın → `npm run payment:check` (konfiqurasiya, baza, Epoint `heartbeat`, imza öz-sınağı) → Ayarlarda "Onlayn kart ödənişi"ni yandırın. Callback axınını real Epoint olmadan yoxlamaq üçün: `npm run payment:simulate -- <sifariş_ID> success` (sizin private key ilə imzalanmış callback göndərir; production-da bloklanıb).
- **Geri qaytarma:** Sifarişlər səhifəsində ödənilmiş onlayn sifarişdə (OWNER/MANAGER) **"Pulu geri qaytar"** düyməsi Epoint `reverse` API-sini çağırır. Ikiqat kliklə iki dəfə qaytarma olmasın deyə əvvəl baza `REFUNDED` edilir, provayder rədd edərsə geri alınır.
- **Canlıya çıxmaq üçün:** 1) [epoint.az](https://epoint.az) merchant hesabı açın, `public_key` / `private_key` alın; 2) `backend/.env`: `PAYMENT_PROVIDER=epoint`, `EPOINT_PUBLIC_KEY`, `EPOINT_PRIVATE_KEY`, `PUBLIC_URL=https://sizin-domen.az`; 3) Epoint panelində **Result URL** = `https://sizin-domen.az/api/payments/epoint/callback` (callback serverinizə İNTERNETDƏN çatmalıdır — localhost-da işləmir; orada status "yoxla" mexanizmi ilə çəkilir); 4) serveri yenidən başladın, Ayarlarda "Onlayn kart ödənişi"ni yandırın; 5) **kiçik məbləğlə bir real/sandbox ödəniş edib** yoxlayın — adapter Epoint sənədinə görə yazılıb, sizin hesabınızla hələ sınanmayıb. Geri qaytarma (refund) Epoint panelindən edilir; callback ilə gəlsə sifariş "Geri qaytarılıb" olur.
- **İnkişaf/demo:** `PAYMENT_PROVIDER=test` — saxta ödəniş səhifəsi (`/pay/test`, "Uğurlu ödə / Rədd et"), real pul yoxdur. `NODE_ENV=production`-da avtomatik söndürülür.
- Yeni provayder əlavə etmək: `backend/src/services/payments/` altında `createPayment / parseCallback / fetchStatus` verən adapter yazıb `index.js`-ə qoşun.

## Struktur

```
backend/src   config · routes · controllers · services · repositories · validators · middleware · sockets · utils
backend/database   schema.sql (sıfırdan) · migrations/ (əlavə-yönlü)
frontend/src  pages (müştəri) · admin · components · store (Zustand) · lib (api, socket, i18n, theme)
```
