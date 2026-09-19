-- Migration 016: e-poçt ilə şifrə sıfırlama və e-poçt təsdiqi (birdəfəlik, hash-lənmiş tokenlər)
USE qr_menu;
GO

IF COL_LENGTH('admin_users', 'email_verified_at') IS NULL
    ALTER TABLE admin_users ADD email_verified_at DATETIME2 NULL;
GO

IF OBJECT_ID('email_tokens', 'U') IS NULL
BEGIN
    CREATE TABLE email_tokens (
        id            INT IDENTITY(1,1) PRIMARY KEY,
        admin_user_id INT NOT NULL FOREIGN KEY REFERENCES admin_users(id) ON DELETE CASCADE,
        purpose       NVARCHAR(20) NOT NULL CHECK (purpose IN (N'reset', N'verify')),
        token_hash    CHAR(64) NOT NULL,           -- SHA-256(token); tokenin özü heç vaxt saxlanılmır
        created_at    DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        expires_at    DATETIME2 NOT NULL,
        used_at       DATETIME2 NULL,
        CONSTRAINT UQ_email_tokens_hash UNIQUE (token_hash)
    );
    CREATE INDEX IX_email_tokens_user ON email_tokens (admin_user_id, purpose, created_at);
END
GO
