-- Migration 010: standart tərkib komponentləri kataloqu (AZ/EN/RU) və məhsul ↔ komponent əlaqəsi (sıralı)
USE qr_menu;
GO

IF OBJECT_ID('ingredients', 'U') IS NULL
BEGIN
    CREATE TABLE ingredients (
        id         INT IDENTITY(1,1) PRIMARY KEY,
        name       NVARCHAR(80) NOT NULL,
        name_en    NVARCHAR(80) NULL,
        name_ru    NVARCHAR(80) NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UQ_ingredients_name UNIQUE (name)
    );
END
GO

IF OBJECT_ID('product_ingredients', 'U') IS NULL
BEGIN
    CREATE TABLE product_ingredients (
        product_id    INT NOT NULL FOREIGN KEY REFERENCES products(id) ON DELETE CASCADE,
        ingredient_id INT NOT NULL FOREIGN KEY REFERENCES ingredients(id),
        sort_order    INT NOT NULL DEFAULT 0,
        PRIMARY KEY (product_id, ingredient_id)
    );
END
GO
-- Mövcud sərbəst mətn tərkibini kataloqa köçürmək üçün: cd backend && npm run migrate:ingredients
