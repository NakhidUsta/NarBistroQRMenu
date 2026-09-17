# QR Menu

Restoran üçün QR-kod əsaslı rəqəmsal menyu sistemi — React (Vite) + Tailwind frontend, Node.js/Express backend (Clean Architecture), SQL Server verilənlər bazası, Socket.io ilə real-time sinxronizasiya.

## Quraşdırma

### 1. Verilənlər bazası

SQL Server-də boş bir `qr_menu` bazası yaradın, sonra sxemi tətbiq edin:

```bash
sqlcmd -S localhost -E -C -f 65001 -d qr_menu -i backend/database/schema.sql
```

`-f 65001` mütləqdir — olmasa, Azərbaycan hərfləri (ə, ş, ğ və s.) sqlcmd-nin defolt konsol kod səhifəsi ilə səhv oxunub verilənlər bazasına korlanmış şəkildə yazılır.

Bu, nümunə restoran, 1 admin istifadəçi (`admin@qrmenu.local` / `ChangeMe123!` — **production-da mütləq dəyişdirin**), kateqoriyalar, məhsullar və 3 masa yaradacaq.

### 2. Backend

```bash
cd backend
npm install
cp .env.example .env   # DB_USER/DB_PASSWORD/JWT_SECRET dəyərlərini doldurun
npm run dev
```

Backend `http://localhost:4000` ünvanında qalxacaq, `/api/health` DB bağlantısını yoxlayır.

### 3. Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Frontend `http://localhost:5174` ünvanında qalxacaq.

- Müştəri menyusu: `http://localhost:5174/menyu`
- Admin panel: `http://localhost:5174/admin/login`

## Struktur

Bax: `.claude/plans` və ya layihə kök qovluğundakı plan sənədi — fazalı inkişaf yol xəritəsi üçün.
