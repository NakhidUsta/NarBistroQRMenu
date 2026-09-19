-- Migration 013: admin sessiyaları və refresh token-lər (qısa ömürlü access token + rotasiya olunan refresh token)
USE qr_menu;
GO

IF OBJECT_ID('admin_sessions', 'U') IS NULL
BEGIN
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
END
GO

IF OBJECT_ID('refresh_tokens', 'U') IS NULL
BEGIN
    CREATE TABLE refresh_tokens (
        id          INT IDENTITY(1,1) PRIMARY KEY,
        session_id  INT NOT NULL FOREIGN KEY REFERENCES admin_sessions(id) ON DELETE CASCADE,
        token_hash  CHAR(64) NOT NULL,             -- SHA-256(token); tokenin özü heç vaxt saxlanılmır
        created_at  DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        expires_at  DATETIME2 NOT NULL,
        used_at     DATETIME2 NULL,                -- rotasiya olunub (təkrar istifadəsi oğurluq əlamətidir)
        CONSTRAINT UQ_refresh_tokens_hash UNIQUE (token_hash)
    );
END
GO
