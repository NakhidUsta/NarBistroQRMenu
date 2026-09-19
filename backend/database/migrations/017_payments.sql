-- Migration 017: ödəniş sistemi (nağd / kartla masada / onlayn kart)
--   orders.payment_method  : CASH | CARD_POS | ONLINE
--   orders.payment_status  : UNPAID (nağd/POS, hələ ödənməyib) | PENDING (onlayn, ödəniş gözlənilir) | PAID | FAILED | REFUNDED
--   payments               : hər ödəniş cəhdi (onlayn provayder tranzaksiyaları + əllə "ödənildi" qeydləri)
--   restaurants.pay_*      : hansı üsullar müştəriyə təklif olunur
-- Kart məlumatları (PAN, CVV) heç vaxt bizim serverdən keçmir və saxlanılmır — kart səhifəsi provayderdədir.
USE qr_menu;
GO

IF COL_LENGTH('orders', 'payment_method') IS NULL
    ALTER TABLE orders ADD
        payment_method NVARCHAR(12) NOT NULL CONSTRAINT DF_orders_payment_method DEFAULT N'CASH',
        payment_status NVARCHAR(12) NOT NULL CONSTRAINT DF_orders_payment_status DEFAULT N'UNPAID',
        paid_at        DATETIME2 NULL,
        paid_amount    DECIMAL(10, 2) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_orders_payment_method')
    ALTER TABLE orders ADD CONSTRAINT CK_orders_payment_method CHECK (payment_method IN (N'CASH', N'CARD_POS', N'ONLINE'));
GO
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_orders_payment_status')
    ALTER TABLE orders ADD CONSTRAINT CK_orders_payment_status CHECK (payment_status IN (N'UNPAID', N'PENDING', N'PAID', N'FAILED', N'REFUNDED'));
GO

-- Köhnə sifarişlər: nağd, ödənişi qeydə alınmayıb (UNPAID) — dəyişiklik yoxdur.

IF COL_LENGTH('restaurants', 'pay_cash') IS NULL
    ALTER TABLE restaurants ADD
        pay_cash     BIT NOT NULL CONSTRAINT DF_restaurants_pay_cash DEFAULT 1,
        pay_card_pos BIT NOT NULL CONSTRAINT DF_restaurants_pay_card_pos DEFAULT 1,
        pay_online   BIT NOT NULL CONSTRAINT DF_restaurants_pay_online DEFAULT 0;
GO

IF OBJECT_ID('payments', 'U') IS NULL
BEGIN
    CREATE TABLE payments (
        id                   INT IDENTITY(1,1) PRIMARY KEY,
        order_id             INT NOT NULL FOREIGN KEY REFERENCES orders(id) ON DELETE CASCADE,
        provider             NVARCHAR(20) NOT NULL,            -- epoint | test | manual
        method               NVARCHAR(12) NOT NULL,            -- CASH | CARD_POS | ONLINE
        status               NVARCHAR(12) NOT NULL DEFAULT N'PENDING'
                             CHECK (status IN (N'PENDING', N'SUCCESS', N'FAILED', N'REFUNDED')),
        amount               DECIMAL(10, 2) NOT NULL CHECK (amount >= 0),
        currency             NVARCHAR(3) NOT NULL DEFAULT N'AZN',
        provider_order_id    NVARCHAR(64) NULL,                 -- provayderə göndərilən unikal ID (cəhd başına)
        provider_transaction NVARCHAR(100) NULL,                -- provayderin tranzaksiya ID-si
        card_mask            NVARCHAR(30) NULL,                 -- yalnız maskalı (415432******1234); tam kart nömrəsi saxlanılmır
        failure_reason       NVARCHAR(300) NULL,
        created_by           INT NULL FOREIGN KEY REFERENCES admin_users(id) ON DELETE SET NULL,  -- əllə qeyd edən işçi
        created_at           DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        updated_at           DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        paid_at              DATETIME2 NULL
    );
    CREATE UNIQUE INDEX UX_payments_provider_order_id ON payments (provider_order_id) WHERE provider_order_id IS NOT NULL;
    CREATE INDEX IX_payments_order ON payments (order_id, created_at);
END
GO
