-- Migration 015: restoran favicon-u (admin paneldən idarə olunur)
USE qr_menu;
GO

IF COL_LENGTH('restaurants', 'favicon_url') IS NULL
    ALTER TABLE restaurants ADD favicon_url NVARCHAR(500) NULL;
GO
