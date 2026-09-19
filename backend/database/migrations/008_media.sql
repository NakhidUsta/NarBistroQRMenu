-- Migration 008: Media Library — yüklənmiş şəkillər və avtomatik yaradılan variantlar (thumb/md/lg, WebP/AVIF)
USE qr_menu;
GO

IF OBJECT_ID('media', 'U') IS NULL
BEGIN
    CREATE TABLE media (
        id            INT IDENTITY(1,1) PRIMARY KEY,
        restaurant_id INT NOT NULL FOREIGN KEY REFERENCES restaurants(id),
        base_name     NVARCHAR(80) NOT NULL,   -- fayl adı (uzantısız): m-<zaman>-<təsadüfi>
        ext           NVARCHAR(5) NOT NULL,    -- orijinalın uzantısı (jpg/png/webp/gif)
        mime          NVARCHAR(30) NOT NULL,
        width         INT NOT NULL,
        height        INT NOT NULL,
        size_bytes    INT NOT NULL,
        parent_id     INT NULL,                -- crop nəticəsidirsə mənbə şəkil
        created_at    DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UQ_media_base_name UNIQUE (base_name)
    );
END
GO
