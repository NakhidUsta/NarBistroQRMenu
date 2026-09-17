-- Migration 003: Çoxdillilik (AZ bazadır, EN/RU əlavə sütunlar)
USE qr_menu;
GO

IF COL_LENGTH('categories', 'name_en') IS NULL
BEGIN
    ALTER TABLE categories ADD name_en NVARCHAR(60) NULL;
    ALTER TABLE categories ADD name_ru NVARCHAR(60) NULL;
END
GO

IF COL_LENGTH('products', 'name_en') IS NULL
BEGIN
    ALTER TABLE products ADD name_en NVARCHAR(120) NULL;
    ALTER TABLE products ADD name_ru NVARCHAR(120) NULL;
    ALTER TABLE products ADD description_en NVARCHAR(MAX) NULL;
    ALTER TABLE products ADD description_ru NVARCHAR(MAX) NULL;
    ALTER TABLE products ADD ingredients_en NVARCHAR(MAX) NULL;
    ALTER TABLE products ADD ingredients_ru NVARCHAR(MAX) NULL;
    ALTER TABLE products ADD allergens_en NVARCHAR(MAX) NULL;
    ALTER TABLE products ADD allergens_ru NVARCHAR(MAX) NULL;
END
GO

IF COL_LENGTH('restaurants', 'name_en') IS NULL
BEGIN
    ALTER TABLE restaurants ADD name_en NVARCHAR(120) NULL;
    ALTER TABLE restaurants ADD name_ru NVARCHAR(120) NULL;
    ALTER TABLE restaurants ADD about_text_en NVARCHAR(MAX) NULL;
    ALTER TABLE restaurants ADD about_text_ru NVARCHAR(MAX) NULL;
END
GO
