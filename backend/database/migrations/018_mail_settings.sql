-- Migration 018: e-poçt (Gmail SMTP) ayarları admin paneldən — .env faylını redaktə etmədən.
-- Şifrə (App Password) AES-256-GCM ilə şifrələnmiş saxlanılır və heç vaxt API-dən geri qaytarılmır.
-- Ayrı cədvəldədir: ictimai /api/restaurant cavabına heç vaxt düşməsin.
USE qr_menu;
GO

IF OBJECT_ID('mail_settings', 'U') IS NULL
BEGIN
    CREATE TABLE mail_settings (
        id            INT NOT NULL PRIMARY KEY CHECK (id = 1),   -- tək sətir
        smtp_user     NVARCHAR(150) NOT NULL,
        smtp_pass_enc NVARCHAR(600) NOT NULL,                    -- "v1:iv:tag:ciphertext" (hex)
        updated_by    INT NULL FOREIGN KEY REFERENCES admin_users(id) ON DELETE SET NULL,
        updated_at    DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
END
GO
