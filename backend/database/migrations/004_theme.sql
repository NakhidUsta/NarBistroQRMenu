-- Migration 004: Admin-idarəli dizayn (rənglər, font, hero, banner, footer) — JSON kimi saxlanılır
USE qr_menu;
GO

IF COL_LENGTH('restaurants', 'theme') IS NULL
BEGIN
    ALTER TABLE restaurants ADD theme NVARCHAR(MAX) NULL;
END
GO
