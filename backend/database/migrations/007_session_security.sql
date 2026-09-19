-- Migration 007: sessiya təhlükəsizliyi — token versiyası (bütün cihazlardan çıxış), uğursuz giriş bloklaması
USE qr_menu;
GO

IF COL_LENGTH('admin_users', 'token_version') IS NULL
BEGIN
    ALTER TABLE admin_users ADD token_version INT NOT NULL DEFAULT 0;
    ALTER TABLE admin_users ADD failed_attempts INT NOT NULL DEFAULT 0;
    ALTER TABLE admin_users ADD locked_until DATETIME2 NULL;
END
GO
