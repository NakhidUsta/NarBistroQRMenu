# Production-a çıxarış (deploy)

Bir server (Linux VM və ya Windows Server) üzərində tək Node prosesi həm API-ni, həm socket-i, həm də build olunmuş frontend-i verir. HTTPS reverse proxy-də bitir.

## 1. Tələblər

- Node.js 20+ , SQL Server (2019+; Express də olar), domen (məs. `menu.example.az`), server üçün 80/443 portları.
- **HTTPS məcburidir**: PWA/service worker, "Ana ekrana əlavə et", müştərinin telefonunda paylaşım pəncərəsi və `secure` cookie yalnız HTTPS-də işləyir.

## 2. Verilənlər bazası

```bash
sqlcmd -S <server> -U <admin> -P <şifrə> -C -Q "CREATE DATABASE qr_menu"
sqlcmd -S <server> -U <admin> -P <şifrə> -C -f 65001 -d qr_menu -i backend/database/schema.sql
```

Sonra **tətbiq üçün ayrıca, məhdud icazəli login** yaradın (`sa` istifadə etməyin): `qr_menu` bazasında `db_datareader`, `db_datawriter` və sxem dəyişməyəcəksə başqa heç nə. Seed admin şifrəsini (`admin@qrmenu.local`) **ilk girişdə dəyişin** (Admin → Hesabım) və ya `npm run reset-password`.

## 3. Backend `.env`

```ini
NODE_ENV=production
PORT=4000
CLIENT_ORIGIN=https://menu.example.az      # CORS + cookie üçün
PUBLIC_URL=https://menu.example.az         # OG/sitemap/robots-da real domen
JWT_SECRET=<uzun təsadüfi sətir: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))">
DB_SERVER=...  DB_NAME=qr_menu  DB_USER=qr_menu_app  DB_PASSWORD=...
TZ_OFFSET_HOURS=4
ADMIN_SESSION_HOURS=12
BACKUP_DIR=/var/backups/qrmenu             # SQL Server maşınında yazıla bilən yol
```

`NODE_ENV=production` olanda cookie `secure` + `SameSite=None` olur və `trust proxy` aktivləşir (real müştəri IP-si üçün — rate limit düzgün işləsin).

## 4. Frontend build

`VITE_*` dəyərləri **build zamanı** bağlanır:

```bash
cd frontend
echo "VITE_API_URL=https://menu.example.az/api"  > .env.production
echo "VITE_SOCKET_URL=https://menu.example.az"  >> .env.production
npm ci && npm run build          # → frontend/dist
```

Backend `frontend/dist`-i özü təqdim edir və hər səhifəyə DB-dən OG/JSON-LD yeridir (başqa yerdədirsə `FRONTEND_DIST=/path/to/dist`).

## 5. Prosesin işə salınması

```bash
cd backend && npm ci --omit=dev
npm i -g pm2
pm2 start src/server.js --name qrmenu
pm2 save && pm2 startup           # server yenidən başlayanda avtomatik qalxsın
```

`backend/uploads/` **daimi qovluqdur** (yüklənmiş şəkillər) — deploy zamanı silinməməli və backup-a daxil edilməlidir.

## 6. nginx + HTTPS (Let's Encrypt)

```nginx
server {
  listen 80;
  server_name menu.example.az;
  return 301 https://$host$request_uri;
}

server {
  listen 443 ssl http2;
  server_name menu.example.az;
  # certbot --nginx -d menu.example.az bu sətirləri avtomatik doldurur
  ssl_certificate     /etc/letsencrypt/live/menu.example.az/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/menu.example.az/privkey.pem;

  client_max_body_size 6m;          # şəkil yükləmə limiti 5 MB

  location / {
    proxy_pass http://127.0.0.1:4000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    # Socket.io (WebSocket) üçün
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 75s;
  }
}
```

```bash
sudo certbot --nginx -d menu.example.az   # sertifikat + avtomatik yenilənmə
```

Cloudflare istifadə edirsinizsə: SSL rejimi **Full (strict)**, WebSockets **açıq**.

## 7. Yoxlama siyahısı

- `https://menu.example.az/api/health` → `status: ok`, DB gecikməsi.
- `/menyu` açılır, brauzerdə "Quraşdır/Ana ekrana əlavə et" təklifi çıxır (service worker aktivdir).
- Səhifənin mənbəyində (`view-source:`) `og:title`, `og:image` və `application/ld+json` restoranınızın məlumatlarıdır; `/sitemap.xml` məhsulları göstərir, `/robots.txt` real domeni.
- WhatsApp/Instagram-da məhsul linki (`/product/1`) şəkil və qiymətlə önizlənir. (Köhnə önizləmə keşlənibsə Facebook Sharing Debugger ilə yeniləyin.)
- Admin girişi işləyir, sifariş verildikdə admin/mətbəx ekranında canlı görünür (WebSocket keçir).
- `npm run backup` əl ilə işlədilir və gündəlik tapşırığa (cron / `schtasks`) əlavə olunur; bir dəfə bərpa sınağı edin.
- Firewall: yalnız 80/443 açıq; SQL Server (1433) internetə **açıq deyil**.

## 8. Yeniləmə

```bash
git pull
cd backend && npm ci --omit=dev      # yeni miqrasiyalar varsa backend/database/migrations/-dan nömrə ardıcıllığı ilə tətbiq edin
cd ../frontend && npm ci && npm run build
pm2 restart qrmenu
```

Miqrasiyalar əlavə-yönlüdür və təkrar işlədilə bilər (`IF NOT EXISTS`).
