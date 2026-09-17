-- Migration 002: Promo kodlar + inventory/stok izləmə
USE qr_menu;
GO

IF OBJECT_ID('promo_codes', 'U') IS NULL
BEGIN
    CREATE TABLE promo_codes (
        id                INT IDENTITY(1,1) PRIMARY KEY,
        restaurant_id     INT NOT NULL FOREIGN KEY REFERENCES restaurants(id),
        code              NVARCHAR(30) NOT NULL,
        discount_type     NVARCHAR(10) NOT NULL CHECK (discount_type IN (N'PERCENT', N'FIXED')),
        discount_value    DECIMAL(10, 2) NOT NULL CHECK (discount_value > 0),
        min_order_amount  DECIMAL(10, 2) NOT NULL DEFAULT 0,
        starts_at         DATETIME2 NULL,
        ends_at           DATETIME2 NULL,
        usage_limit       INT NULL,
        usage_count       INT NOT NULL DEFAULT 0,
        is_active         BIT NOT NULL DEFAULT 1,
        created_at        DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UQ_promo_codes_code UNIQUE (code)
    );
END
GO

IF OBJECT_ID('promo_usage', 'U') IS NULL
BEGIN
    CREATE TABLE promo_usage (
        id               INT IDENTITY(1,1) PRIMARY KEY,
        promo_code_id    INT NOT NULL FOREIGN KEY REFERENCES promo_codes(id),
        order_id         INT NOT NULL FOREIGN KEY REFERENCES orders(id),
        discount_amount  DECIMAL(10, 2) NOT NULL,
        created_at       DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
END
GO

IF COL_LENGTH('orders', 'discount') IS NULL
BEGIN
    ALTER TABLE orders ADD discount DECIMAL(10, 2) NOT NULL DEFAULT 0;
    ALTER TABLE orders ADD promo_code_id INT NULL;
    ALTER TABLE orders ADD promo_code NVARCHAR(30) NULL;
    ALTER TABLE orders ADD CONSTRAINT FK_orders_promo_code FOREIGN KEY (promo_code_id) REFERENCES promo_codes(id);
END
GO

IF COL_LENGTH('products', 'stock_quantity') IS NULL
BEGIN
    ALTER TABLE products ADD stock_quantity INT NULL;
    ALTER TABLE products ADD track_inventory BIT NOT NULL DEFAULT 0;
END
GO

IF OBJECT_ID('stock_movements', 'U') IS NULL
BEGIN
    CREATE TABLE stock_movements (
        id         INT IDENTITY(1,1) PRIMARY KEY,
        product_id INT NOT NULL FOREIGN KEY REFERENCES products(id),
        change_qty INT NOT NULL,
        reason     NVARCHAR(30) NOT NULL CHECK (reason IN (N'restock', N'order', N'manual_adjustment')),
        order_id   INT NULL FOREIGN KEY REFERENCES orders(id),
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
END
GO
