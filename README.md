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

Mövcud bazanı yeniləmək üçün `backend/database/migrations/` fayllarını nömrə ardıcıllığı ilə tətbiq edin (002 promo/inventory, 003 i18n, 004 theme).

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

- **Sessiya:** JWT httpOnly cookie, defolt 12 saat (`ADMIN_SESSION_HOURS`). Hər sorğuda DB-də token versiyası və **cari rol** yoxlanılır: şifrə dəyişəndə, "Bütün cihazlardan çıxış" edəndə, rol dəyişəndə/istifadəçi silinəndə köhnə sessiyalar və açıq socket bağlantıları dərhal bağlanır (admin paneldə **Hesabım**).
- **Giriş qorunması:** IP üzrə 5 uğursuz cəhd / 15 dəq limiti + hesab üzrə 5 uğursuz cəhddən sonra 15 dəqiqəlik bloklama; bcrypt hash; cavab vaxtı ilə istifadəçi adı aşkar olmur.
- **Şifrəni unutdunuz (e-poçt xidməti olmadan):** OWNER işçi şifrəsini **İşçilər** səhifəsindən dəyişə bilər; OWNER özü unudubsa server maşınında:
  ```bash
  cd backend && npm run reset-password -- admin@qrmenu.local YeniSifre123
  ```
  Bütün köhnə sessiyalar bağlanır və hesab bloku götürülür. (E-poçt ilə "sıfırlama linki" və e-poçt təsdiqi üçün SMTP/e-poçt provayderi lazımdır — hələ qoşulmayıb.)
- **DB backup:** `cd backend && npm run backup` — sıxılmış, CHECKSUM ilə tam backup (`BACKUP_DIR`, defolt SQL Server-in backup qovluğu), 14 gündən köhnələri silinir. Gündəlik işə salmaq üçün (Windows):
  ```bash
  schtasks /Create /SC DAILY /ST 03:00 /TN "QRMenuBackup" /TR "cmd /c cd /d C:\path\to\qr-menu\backend && npm run backup"
  ```
  Bərpanı sınayın: `RESTORE VERIFYONLY FROM DISK = N'...bak' WITH CHECKSUM` (sysadmin ilə).
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
cd backend  && npm test            # Jest + Supertest (DB-siz: API icazələri, validasiya, servis məntiqi)
cd frontend && npm test            # Vitest + React Testing Library
cd frontend && npx playwright test # E2E — backend (:4000) və frontend (:5174) işləyərkən, real DB üzərində
```

E2E, PDF-in 23 addımlı ssenarisini icra edir (admin məhsul yaradır → müştəri refresh-siz görür → sifariş → status → "bitib" → qiymət → ümumi `/menyu` linki). Test öz məhsulunu silir, sifarişi ləğv edir.

## PWA / SEO

- `public/manifest.webmanifest`, `public/sw.js` (menyu API-si network-first, şəkillər stale-while-revalidate, offline səhifə), ikonlar `public/icons/`. Service worker yalnız **production build**-də (`npm run build && npm run preview`) qeydiyyatdan keçir.
- `robots.txt` / `sitemap.xml` daxilində `DOMAIN.com` yer tutucusunu deploy zamanı real domenlə əvəz edin.
- Qeyd: WhatsApp/sosial şəbəkə önizləməsi SPA-nın statik `index.html` meta teqlərindən oxuyur; restorana xas dinamik OG üçün server-side inyeksiya lazımdır (hələ yoxdur).

## Media kitabxanası

Admin → **Media** (OWNER/MANAGER). Hər yüklənən şəkil (`POST /api/upload`, bayt-imza yoxlaması ilə) `media` cədvəlinə yazılır və `backend/uploads/`-də saxlanılır:

- orijinal (EXIF/GPS silinmiş, `m-<vaxt>-<hex>.<ext>`) + **thumb 240px / md 640px / lg 1280px** WebP və **md/lg AVIF** variantları (kiçik şəkil böyüdülmür);
- **kəsmə** (`POST /api/media/:id/crop`, nisbət `1:1 | 4:3 | 16:9`, fokus `attention | centre`) orijinalı saxlayıb yeni şəkil yaradır;
- **silmə** — istifadədə olan (məhsul/tema şəkli) şəkil üçün `409`; silinəndə bütün variantlar da silinir;
- məhsul/tema formalarında “Kitabxanadan seç” ilə əsas şəkil seçilir; müştəri UI-ı `<picture>` (AVIF → WebP → orijinal) və `srcset` istifadə edir. Köhnə yükləmələr və xarici URL-lər olduğu kimi göstərilir.

## Struktur

```
backend/src   config · routes · controllers · services · repositories · validators · middleware · sockets · utils
backend/database   schema.sql (sıfırdan) · migrations/ (əlavə-yönlü)
frontend/src  pages (müştəri) · admin · components · store (Zustand) · lib (api, socket, i18n, theme)
```
