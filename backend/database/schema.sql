-- QR Menu — SQL Server (T-SQL) sxemi + nümunə (seed) data
-- İstifadə (SSMS-də və ya sqlcmd ilə):
--   1) Boş bir "qr_menu" bazası yaradın (CREATE DATABASE qr_menu;)
--   2) sqlcmd -S localhost -E -C -f 65001 -d qr_menu -i schema.sql

SET QUOTED_IDENTIFIER ON; -- filtrli unikal indeks üçün lazımdır (sqlcmd defoltda OFF)
GO
USE qr_menu;
GO

-- ============ CƏDVƏLLƏR ============

IF OBJECT_ID('refresh_tokens', 'U') IS NOT NULL DROP TABLE refresh_tokens;
IF OBJECT_ID('admin_sessions', 'U') IS NOT NULL DROP TABLE admin_sessions;
IF OBJECT_ID('product_ingredients', 'U') IS NOT NULL DROP TABLE product_ingredients;
IF OBJECT_ID('ingredients', 'U') IS NOT NULL DROP TABLE ingredients;
IF OBJECT_ID('product_allergens', 'U') IS NOT NULL DROP TABLE product_allergens;
IF OBJECT_ID('allergens', 'U') IS NOT NULL DROP TABLE allergens;
IF OBJECT_ID('product_images', 'U') IS NOT NULL DROP TABLE product_images;
IF OBJECT_ID('media', 'U') IS NOT NULL DROP TABLE media;
IF OBJECT_ID('reviews', 'U') IS NOT NULL DROP TABLE reviews;
IF OBJECT_ID('promo_usage', 'U') IS NOT NULL DROP TABLE promo_usage;
IF OBJECT_ID('stock_movements', 'U') IS NOT NULL DROP TABLE stock_movements;
IF OBJECT_ID('order_status_history', 'U') IS NOT NULL DROP TABLE order_status_history;
IF OBJECT_ID('order_items', 'U') IS NOT NULL DROP TABLE order_items;
IF OBJECT_ID('orders', 'U') IS NOT NULL DROP TABLE orders;
IF OBJECT_ID('promo_codes', 'U') IS NOT NULL DROP TABLE promo_codes;
IF OBJECT_ID('table_sessions', 'U') IS NOT NULL DROP TABLE table_sessions;
IF OBJECT_ID('restaurant_tables', 'U') IS NOT NULL DROP TABLE restaurant_tables;
IF OBJECT_ID('products', 'U') IS NOT NULL DROP TABLE products;
IF OBJECT_ID('categories', 'U') IS NOT NULL DROP TABLE categories;
IF OBJECT_ID('audit_logs', 'U') IS NOT NULL DROP TABLE audit_logs;
IF OBJECT_ID('notifications', 'U') IS NOT NULL DROP TABLE notifications;
IF OBJECT_ID('admin_users', 'U') IS NOT NULL DROP TABLE admin_users;
IF OBJECT_ID('restaurants', 'U') IS NOT NULL DROP TABLE restaurants;
GO

CREATE TABLE restaurants (
    id                     INT IDENTITY(1,1) PRIMARY KEY,
    name                   NVARCHAR(120) NOT NULL,
    logo_url               NVARCHAR(MAX),
    favicon_url            NVARCHAR(500) NULL,
    phone                  NVARCHAR(30),
    whatsapp               NVARCHAR(30),
    address                NVARCHAR(250),
    google_maps_link       NVARCHAR(MAX),
    working_hours          NVARCHAR(150),
    email                  NVARCHAR(150),
    about_text             NVARCHAR(MAX),
    instagram_link         NVARCHAR(MAX),
    facebook_link          NVARCHAR(MAX),
    tiktok_link            NVARCHAR(MAX),
    allow_tableless_orders BIT NOT NULL DEFAULT 0,
    name_en                NVARCHAR(120) NULL,
    name_ru                NVARCHAR(120) NULL,
    about_text_en          NVARCHAR(MAX) NULL,
    about_text_ru          NVARCHAR(MAX) NULL,
    theme                  NVARCHAR(MAX) NULL, -- JSON: rənglər, font, hero, banner, footer
    vat_percent            DECIMAL(5, 2) NOT NULL DEFAULT 0,
    service_fee_percent    DECIMAL(5, 2) NOT NULL DEFAULT 0,
    delivery_fee           DECIMAL(10, 2) NOT NULL DEFAULT 0, -- yalnız masasız (takeaway) sifarişlərə
    currency               NVARCHAR(3) NOT NULL DEFAULT N'AZN',
    created_at             DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

CREATE TABLE admin_users (
    id            INT IDENTITY(1,1) PRIMARY KEY,
    restaurant_id INT NOT NULL FOREIGN KEY REFERENCES restaurants(id),
    email         NVARCHAR(150) NOT NULL UNIQUE,
    password_hash NVARCHAR(MAX) NOT NULL,
    role          NVARCHAR(20) NOT NULL DEFAULT N'OWNER'
                  CHECK (role IN (N'OWNER', N'MANAGER', N'WAITER', N'KITCHEN')),
    token_version   INT NOT NULL DEFAULT 0,   -- artırılanda köhnə sessiyalar etibarsız olur
    failed_attempts INT NOT NULL DEFAULT 0,
    locked_until    DATETIME2 NULL,
    created_at    DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

CREATE TABLE admin_sessions (
    id            INT IDENTITY(1,1) PRIMARY KEY,
    admin_user_id INT NOT NULL FOREIGN KEY REFERENCES admin_users(id) ON DELETE CASCADE,
    user_agent    NVARCHAR(300) NULL,
    ip            NVARCHAR(64) NULL,
    created_at    DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    last_used_at  DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    expires_at    DATETIME2 NOT NULL,          -- mütləq ömür (bundan sonra yenidən giriş)
    revoked_at    DATETIME2 NULL
);
CREATE INDEX IX_admin_sessions_user ON admin_sessions (admin_user_id, revoked_at);
GO

CREATE TABLE refresh_tokens (
    id          INT IDENTITY(1,1) PRIMARY KEY,
    session_id  INT NOT NULL FOREIGN KEY REFERENCES admin_sessions(id) ON DELETE CASCADE,
    token_hash  CHAR(64) NOT NULL,             -- SHA-256(token); tokenin özü heç vaxt saxlanılmır
    created_at  DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    expires_at  DATETIME2 NOT NULL,
    used_at     DATETIME2 NULL,                -- rotasiya olunub (təkrar istifadəsi oğurluq əlamətidir)
    CONSTRAINT UQ_refresh_tokens_hash UNIQUE (token_hash)
);
GO

CREATE TABLE categories (
    id            INT IDENTITY(1,1) PRIMARY KEY,
    restaurant_id INT NOT NULL FOREIGN KEY REFERENCES restaurants(id),
    name          NVARCHAR(60) NOT NULL,
    name_en       NVARCHAR(60) NULL,
    name_ru       NVARCHAR(60) NULL,
    slug          NVARCHAR(60) NOT NULL,
    sort_order    INT NOT NULL DEFAULT 0,
    is_active     BIT NOT NULL DEFAULT 1,
    created_at    DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT UQ_categories_slug UNIQUE (slug)
);
GO

CREATE TABLE products (
    id                INT IDENTITY(1,1) PRIMARY KEY,
    restaurant_id     INT NOT NULL FOREIGN KEY REFERENCES restaurants(id),
    category_id       INT NULL FOREIGN KEY REFERENCES categories(id),
    name              NVARCHAR(120) NOT NULL,
    name_en           NVARCHAR(120) NULL,
    name_ru           NVARCHAR(120) NULL,
    description       NVARCHAR(MAX),
    description_en    NVARCHAR(MAX) NULL,
    description_ru    NVARCHAR(MAX) NULL,
    price             DECIMAL(10, 2) NOT NULL CHECK (price >= 0),
    image_url         NVARCHAR(MAX),
    ingredients       NVARCHAR(MAX),
    ingredients_en    NVARCHAR(MAX) NULL,
    ingredients_ru    NVARCHAR(MAX) NULL,
    allergens         NVARCHAR(MAX),
    allergens_en      NVARCHAR(MAX) NULL,
    allergens_ru      NVARCHAR(MAX) NULL,
    prep_time_minutes INT NULL,
    is_available      BIT NOT NULL DEFAULT 1,   -- 0 = "Bitib" (menyuda görünür, sifariş olunmur)
    is_visible        BIT NOT NULL DEFAULT 1,   -- 0 = müştərilərdən tamamilə gizlidir
    is_popular        BIT NOT NULL DEFAULT 0,
    sort_order        INT NOT NULL DEFAULT 0,
    stock_quantity    INT NULL,               -- NULL = stok izlənmir (limitsiz)
    track_inventory   BIT NOT NULL DEFAULT 0,
    created_at        DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

CREATE TABLE restaurant_tables (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    restaurant_id   INT NOT NULL FOREIGN KEY REFERENCES restaurants(id),
    label           NVARCHAR(40) NOT NULL,
    code            NVARCHAR(40) NOT NULL,
    capacity        INT NOT NULL DEFAULT 2 CHECK (capacity > 0),
    qr_token        NVARCHAR(64) NOT NULL,
    is_active       BIT NOT NULL DEFAULT 1,
    scan_count      INT NOT NULL DEFAULT 0,
    last_scanned_at DATETIME2 NULL,
    created_at      DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at      DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT UQ_restaurant_tables_code UNIQUE (code),
    CONSTRAINT UQ_restaurant_tables_qr_token UNIQUE (qr_token)
);
GO

CREATE TABLE table_sessions (
    id         INT IDENTITY(1,1) PRIMARY KEY,
    table_id   INT NOT NULL FOREIGN KEY REFERENCES restaurant_tables(id),
    status     NVARCHAR(20) NOT NULL DEFAULT N'ACTIVE'
               CHECK (status IN (N'ACTIVE', N'CLOSED')),
    opened_at  DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    closed_at  DATETIME2 NULL
);
GO

CREATE TABLE promo_codes (
    id                INT IDENTITY(1,1) PRIMARY KEY,
    restaurant_id     INT NOT NULL FOREIGN KEY REFERENCES restaurants(id),
    code              NVARCHAR(30) NOT NULL,
    discount_type     NVARCHAR(10) NOT NULL CHECK (discount_type IN (N'PERCENT', N'FIXED')),
    discount_value    DECIMAL(10, 2) NOT NULL CHECK (discount_value > 0),
    min_order_amount  DECIMAL(10, 2) NOT NULL DEFAULT 0,
    starts_at         DATETIME2 NULL,
    ends_at           DATETIME2 NULL,
    usage_limit       INT NULL,
    usage_count       INT NOT NULL DEFAULT 0,
    is_active         BIT NOT NULL DEFAULT 1,
    created_at        DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT UQ_promo_codes_code UNIQUE (code)
);
GO

CREATE TABLE orders (
    id               INT IDENTITY(1,1) PRIMARY KEY,
    restaurant_id    INT NOT NULL FOREIGN KEY REFERENCES restaurants(id),
    table_id         INT NULL FOREIGN KEY REFERENCES restaurant_tables(id),
    table_session_id INT NULL FOREIGN KEY REFERENCES table_sessions(id),
    customer_name    NVARCHAR(120) NOT NULL,
    phone            NVARCHAR(30) NOT NULL,
    status           NVARCHAR(20) NOT NULL DEFAULT N'NEW'
                     CHECK (status IN (N'NEW', N'CONFIRMED', N'PREPARING', N'READY', N'DELIVERED', N'COMPLETED', N'CANCELLED')),
    subtotal         DECIMAL(10, 2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
    discount         DECIMAL(10, 2) NOT NULL DEFAULT 0 CHECK (discount >= 0),
    vat              DECIMAL(10, 2) NOT NULL DEFAULT 0,
    service_fee      DECIMAL(10, 2) NOT NULL DEFAULT 0,
    delivery_fee     DECIMAL(10, 2) NOT NULL DEFAULT 0,
    currency         NVARCHAR(3) NOT NULL DEFAULT N'AZN',
    total            DECIMAL(10, 2) NOT NULL DEFAULT 0 CHECK (total >= 0),
    promo_code_id    INT NULL FOREIGN KEY REFERENCES promo_codes(id),
    promo_code       NVARCHAR(30) NULL,
    note             NVARCHAR(300) NULL,
    access_token     NVARCHAR(64) NOT NULL,
    client_request_id NVARCHAR(64) NULL,     -- idempotency açarı: eyni sorğunun təkrarı ikinci sifariş yaratmır
    created_at       DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

CREATE UNIQUE INDEX UX_orders_client_request_id ON orders (client_request_id) WHERE client_request_id IS NOT NULL;
GO

CREATE TABLE order_items (
    id             INT IDENTITY(1,1) PRIMARY KEY,
    order_id       INT NOT NULL FOREIGN KEY REFERENCES orders(id) ON DELETE CASCADE,
    product_id     INT NULL FOREIGN KEY REFERENCES products(id) ON DELETE SET NULL,
    quantity       INT NOT NULL CHECK (quantity > 0),
    price_at_order DECIMAL(10, 2) NOT NULL CHECK (price_at_order >= 0)
);
GO

CREATE TABLE order_status_history (
    id         INT IDENTITY(1,1) PRIMARY KEY,
    order_id   INT NOT NULL FOREIGN KEY REFERENCES orders(id) ON DELETE CASCADE,
    status     NVARCHAR(20) NOT NULL,
    changed_by INT NULL FOREIGN KEY REFERENCES admin_users(id),
    note       NVARCHAR(300) NULL,
    created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

CREATE TABLE media (
    id            INT IDENTITY(1,1) PRIMARY KEY,
    restaurant_id INT NOT NULL FOREIGN KEY REFERENCES restaurants(id),
    base_name     NVARCHAR(80) NOT NULL,
    ext           NVARCHAR(5) NOT NULL,
    mime          NVARCHAR(30) NOT NULL,
    width         INT NOT NULL,
    height        INT NOT NULL,
    size_bytes    INT NOT NULL,
    parent_id     INT NULL,
    created_at    DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT UQ_media_base_name UNIQUE (base_name)
);
GO

CREATE TABLE product_images (
    id         INT IDENTITY(1,1) PRIMARY KEY,
    product_id INT NOT NULL FOREIGN KEY REFERENCES products(id) ON DELETE CASCADE,
    image_url  NVARCHAR(500) NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
CREATE INDEX IX_product_images_product ON product_images (product_id, sort_order);
GO

CREATE TABLE allergens (
    id         INT IDENTITY(1,1) PRIMARY KEY,
    code       NVARCHAR(30) NOT NULL UNIQUE,
    name       NVARCHAR(60) NOT NULL,
    name_en    NVARCHAR(60) NULL,
    name_ru    NVARCHAR(60) NULL,
    icon       NVARCHAR(10) NULL,
    sort_order INT NOT NULL DEFAULT 0
);
GO

CREATE TABLE product_allergens (
    product_id  INT NOT NULL FOREIGN KEY REFERENCES products(id) ON DELETE CASCADE,
    allergen_id INT NOT NULL FOREIGN KEY REFERENCES allergens(id) ON DELETE CASCADE,
    PRIMARY KEY (product_id, allergen_id)
);
GO

CREATE TABLE ingredients (
    id         INT IDENTITY(1,1) PRIMARY KEY,
    name       NVARCHAR(80) NOT NULL,
    name_en    NVARCHAR(80) NULL,
    name_ru    NVARCHAR(80) NULL,
    created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT UQ_ingredients_name UNIQUE (name)
);
GO

CREATE TABLE product_ingredients (
    product_id    INT NOT NULL FOREIGN KEY REFERENCES products(id) ON DELETE CASCADE,
    ingredient_id INT NOT NULL FOREIGN KEY REFERENCES ingredients(id),
    sort_order    INT NOT NULL DEFAULT 0,
    PRIMARY KEY (product_id, ingredient_id)
);
GO

CREATE TABLE reviews (
    id            INT IDENTITY(1,1) PRIMARY KEY,
    restaurant_id INT NOT NULL FOREIGN KEY REFERENCES restaurants(id),
    order_id      INT NOT NULL FOREIGN KEY REFERENCES orders(id) ON DELETE CASCADE,
    customer_name NVARCHAR(120) NOT NULL,
    rating        INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment       NVARCHAR(1000) NULL,
    is_approved   BIT NOT NULL DEFAULT 0,
    created_at    DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT UQ_reviews_order UNIQUE (order_id)
);
GO

CREATE TABLE promo_usage (
    id               INT IDENTITY(1,1) PRIMARY KEY,
    promo_code_id    INT NOT NULL FOREIGN KEY REFERENCES promo_codes(id),
    order_id         INT NOT NULL FOREIGN KEY REFERENCES orders(id),
    discount_amount  DECIMAL(10, 2) NOT NULL,
    created_at       DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

CREATE TABLE stock_movements (
    id         INT IDENTITY(1,1) PRIMARY KEY,
    product_id INT NOT NULL FOREIGN KEY REFERENCES products(id),
    change_qty INT NOT NULL,
    reason     NVARCHAR(30) NOT NULL CHECK (reason IN (N'restock', N'order', N'manual_adjustment')),
    order_id   INT NULL FOREIGN KEY REFERENCES orders(id),
    created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

CREATE TABLE notifications (
    id            INT IDENTITY(1,1) PRIMARY KEY,
    restaurant_id INT NOT NULL FOREIGN KEY REFERENCES restaurants(id),
    type          NVARCHAR(40) NOT NULL
                  CONSTRAINT CK_notifications_type CHECK (type IN (N'order_created', N'call_waiter', N'request_bill', N'low_stock', N'out_of_stock', N'system_error')),
    title         NVARCHAR(150) NOT NULL,
    body          NVARCHAR(500) NULL,
    entity_type   NVARCHAR(60) NULL,
    entity_id     INT NULL,
    is_read       BIT NOT NULL DEFAULT 0,
    status        NVARCHAR(20) NOT NULL DEFAULT N'OPEN' CONSTRAINT CK_notifications_status CHECK (status IN (N'OPEN', N'ACCEPTED', N'RESOLVED')), -- Call Waiter / Request Bill iş axını
    handled_by    INT NULL FOREIGN KEY REFERENCES admin_users(id) ON DELETE SET NULL,
    handled_at    DATETIME2 NULL,
    created_at    DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

CREATE TABLE audit_logs (
    id            INT IDENTITY(1,1) PRIMARY KEY,
    admin_user_id INT NULL FOREIGN KEY REFERENCES admin_users(id),
    action        NVARCHAR(60) NOT NULL,
    entity_type   NVARCHAR(60) NOT NULL,
    entity_id     NVARCHAR(60) NULL,
    before_json   NVARCHAR(MAX) NULL,
    after_json    NVARCHAR(MAX) NULL,
    ip_address    NVARCHAR(64) NULL,
    created_at    DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

-- ============ SEED DATA ============

INSERT INTO restaurants (name, phone, whatsapp, address, working_hours, email, about_text, instagram_link, allow_tableless_orders) VALUES
(N'QR Menu Restaurant', N'+994 12 345 67 89', N'+994 50 123 45 67', N'Nizami küç. 10, Bakı', N'Hər gün 10:00 – 23:00', N'hello@qrmenu.local', N'Rəqəmsal menyu təcrübəsi ilə qonaqlarımıza sürətli və rahat sifariş imkanı təqdim edirik.', N'https://instagram.com', 1);
GO

-- Şifrə: "ChangeMe123!" (bcrypt, cost 10) — bu, yalnız DEV üçün başlanğıc şifrədir, production-da mütləq dəyişdirin.
INSERT INTO admin_users (restaurant_id, email, password_hash, role) VALUES
(1, N'admin@qrmenu.local', N'$2b$10$Q3LGahSMUEBHKdIc0gmnRehjrSFPudb2KBR.Xos3w6qCI9DAVmYrm', N'OWNER');
GO

INSERT INTO categories (restaurant_id, name, slug, sort_order) VALUES
(1, N'Başlanğıclar', N'starters', 0),
(1, N'Əsas yeməklər', N'mains', 1),
(1, N'Desertlər', N'desserts', 2),
(1, N'İçkilər', N'drinks', 3);
GO

INSERT INTO products (restaurant_id, category_id, name, description, price, image_url, ingredients, allergens, prep_time_minutes, is_popular, sort_order) VALUES
(1, (SELECT id FROM categories WHERE slug = N'mains'), N'Truffle Pasta', N'Krem-truffle sousu, parmezan, göbələk, təzə otlar.', 24.00, N'https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=800&h=800&fit=crop', N'Fettuccine pasta, truffle krem sousu, vəhşi göbələk, parmezan pendiri, sarımsaq, cəfəri', N'Süd məhsulları, qluten', 18, 1, 0),
(1, (SELECT id FROM categories WHERE slug = N'mains'), N'Grilled Salmon', N'Təzə somon, mövsümi tərəvəzlər, limon-kərə sousu.', 28.00, N'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&h=800&fit=crop', N'Somon fileti, brokoli, yerkökü, limon, kərə, otlar', N'Balıq, süd məhsulları', 20, 1, 1),
(1, (SELECT id FROM categories WHERE slug = N'mains'), N'Ribeye Steak', N'Premium ribeye, sarımsaqlı kartof püresi, mövsümi tərəvəzlər.', 36.00, N'https://images.unsplash.com/photo-1544025162-d76694265947?w=800&h=800&fit=crop', N'Mal əti (ribeye), kartof, kərə, sarımsaq, rozmarin', N'Süd məhsulları', 25, 0, 2),
(1, (SELECT id FROM categories WHERE slug = N'desserts'), N'Cheesecake', N'Klassik cheesecake, qarışıq giləmeyvə sousu.', 9.00, N'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=800&h=800&fit=crop', N'Krem pendir, bisküvi, yumurta, giləmeyvə sousu', N'Süd məhsulları, qluten, yumurta', 5, 0, 3),
(1, (SELECT id FROM categories WHERE slug = N'starters'), N'Fəsil tərəvəz salatı', N'Mövsümün ən təzə tərəvəzləri ilə hazırlanıb.', 12.00, N'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&h=800&fit=crop', N'Qarışıq yaşıllıq, pomidor, xiyar, zeytun yağı, limon', N'Yoxdur', 8, 0, 0),
(1, (SELECT id FROM categories WHERE slug = N'drinks'), N'Təzə portağal şirəsi', N'100% təbii, sıxılmış portağal şirəsi.', 6.00, N'https://images.unsplash.com/photo-1600891964599-f61ba0e24092?w=800&h=800&fit=crop', N'Təzə portağal', N'Yoxdur', 3, 0, 0);
GO

-- AB-nin 14 əsas allergeni
INSERT INTO allergens (code, name, name_en, name_ru, icon, sort_order) VALUES
(N'gluten',      N'Qlüten',          N'Gluten',       N'Глютен',         N'🌾', 1),
(N'crustaceans', N'Xərçəngkimilər',  N'Crustaceans',  N'Ракообразные',   N'🦀', 2),
(N'eggs',        N'Yumurta',         N'Eggs',         N'Яйца',           N'🥚', 3),
(N'fish',        N'Balıq',           N'Fish',         N'Рыба',           N'🐟', 4),
(N'peanuts',     N'Yerfındığı',      N'Peanuts',      N'Арахис',         N'🥜', 5),
(N'soy',         N'Soya',            N'Soy',          N'Соя',            N'🫘', 6),
(N'milk',        N'Süd',             N'Milk',         N'Молоко',         N'🥛', 7),
(N'nuts',        N'Qoz-fındıq',      N'Tree nuts',    N'Орехи',          N'🌰', 8),
(N'celery',      N'Kərəviz',         N'Celery',       N'Сельдерей',      N'🥬', 9),
(N'mustard',     N'Xardal',          N'Mustard',      N'Горчица',        N'🟡', 10),
(N'sesame',      N'Küncüt',          N'Sesame',       N'Кунжут',         N'🌱', 11),
(N'sulphites',   N'Sulfitlər',       N'Sulphites',    N'Сульфиты',       N'🍷', 12),
(N'lupin',       N'Lüpin',           N'Lupin',        N'Люпин',          N'🌼', 13),
(N'molluscs',    N'Molyuskalar',     N'Molluscs',     N'Моллюски',       N'🐚', 14);
GO

-- nümunə məhsulların əsas şəkli qalereyanın birinci elementi və allergen əlaqələri
INSERT INTO product_images (product_id, image_url, sort_order)
SELECT id, LEFT(image_url, 500), 0 FROM products WHERE image_url IS NOT NULL;

INSERT INTO product_allergens (product_id, allergen_id)
SELECT p.id, a.id FROM (VALUES
    (N'Truffle Pasta', N'milk'), (N'Truffle Pasta', N'gluten'),
    (N'Grilled Salmon', N'fish'), (N'Grilled Salmon', N'milk'),
    (N'Ribeye Steak', N'milk'),
    (N'Cheesecake', N'milk'), (N'Cheesecake', N'gluten'), (N'Cheesecake', N'eggs')
) AS m(product_name, allergen_code)
JOIN products p ON p.name = m.product_name
JOIN allergens a ON a.code = m.allergen_code;
GO

INSERT INTO restaurant_tables (restaurant_id, label, code, capacity, qr_token) VALUES
(1, N'Masa 1', N'table_001', 2, N'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6'),
(1, N'Masa 2', N'table_002', 4, N'b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6a1'),
(1, N'Masa 3', N'table_003', 4, N'c3d4e5f6a7b8c9d0e1f2a3b4c5d6a1b2');
GO

INSERT INTO promo_codes (restaurant_id, code, discount_type, discount_value, min_order_amount) VALUES
(1, N'XOSGEL10', N'PERCENT', 10, 20);
GO
