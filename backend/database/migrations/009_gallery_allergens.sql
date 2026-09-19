-- Migration 009: məhsul qalereyası (çox şəkil) və standart allergen kataloqu (məhsul ↔ allergen əlaqəsi)
USE qr_menu;
GO

IF OBJECT_ID('product_images', 'U') IS NULL
BEGIN
    CREATE TABLE product_images (
        id         INT IDENTITY(1,1) PRIMARY KEY,
        product_id INT NOT NULL FOREIGN KEY REFERENCES products(id) ON DELETE CASCADE,
        image_url  NVARCHAR(500) NOT NULL,
        sort_order INT NOT NULL DEFAULT 0,      -- 0 = əsas şəkil (products.image_url ilə eyni saxlanılır)
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
    CREATE INDEX IX_product_images_product ON product_images (product_id, sort_order);

    -- mövcud əsas şəkilləri qalereyanın birinci elementi et
    INSERT INTO product_images (product_id, image_url, sort_order)
    SELECT id, LEFT(image_url, 500), 0 FROM products WHERE image_url IS NOT NULL AND image_url <> '';
END
GO

IF OBJECT_ID('allergens', 'U') IS NULL
BEGIN
    CREATE TABLE allergens (
        id         INT IDENTITY(1,1) PRIMARY KEY,
        code       NVARCHAR(30) NOT NULL UNIQUE,
        name       NVARCHAR(60) NOT NULL,
        name_en    NVARCHAR(60) NULL,
        name_ru    NVARCHAR(60) NULL,
        icon       NVARCHAR(10) NULL,
        sort_order INT NOT NULL DEFAULT 0
    );
END
GO

IF OBJECT_ID('product_allergens', 'U') IS NULL
BEGIN
    CREATE TABLE product_allergens (
        product_id  INT NOT NULL FOREIGN KEY REFERENCES products(id) ON DELETE CASCADE,
        allergen_id INT NOT NULL FOREIGN KEY REFERENCES allergens(id) ON DELETE CASCADE,
        PRIMARY KEY (product_id, allergen_id)
    );
END
GO

-- AB-nin 14 əsas allergeni (idempotent)
INSERT INTO allergens (code, name, name_en, name_ru, icon, sort_order)
SELECT v.code, v.name, v.name_en, v.name_ru, v.icon, v.sort_order
FROM (VALUES
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
    (N'molluscs',    N'Molyuskalar',     N'Molluscs',     N'Моллюски',       N'🐚', 14)
) AS v(code, name, name_en, name_ru, icon, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM allergens a WHERE a.code = v.code);
GO
