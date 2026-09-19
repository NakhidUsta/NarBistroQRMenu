-- Migration 014: məhsulu müştərilərdən tamamilə gizlətmə (is_visible). "Bitib" (is_available=0) məhsul menyuda görünür və "Bitib" yazılır; gizli məhsul isə heç göstərilmir.
USE qr_menu;
GO

IF COL_LENGTH('products', 'is_visible') IS NULL
    ALTER TABLE products ADD is_visible BIT NOT NULL CONSTRAINT DF_products_is_visible DEFAULT 1;
GO
