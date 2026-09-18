-- Migration 005: VAT, servis haqqı, çatdırılma (takeaway) haqqı — bütün hesablama backend-də
USE qr_menu;
GO

IF COL_LENGTH('restaurants', 'vat_percent') IS NULL
BEGIN
    ALTER TABLE restaurants ADD vat_percent DECIMAL(5, 2) NOT NULL DEFAULT 0;
    ALTER TABLE restaurants ADD service_fee_percent DECIMAL(5, 2) NOT NULL DEFAULT 0;
    ALTER TABLE restaurants ADD delivery_fee DECIMAL(10, 2) NOT NULL DEFAULT 0;
    ALTER TABLE restaurants ADD currency NVARCHAR(3) NOT NULL DEFAULT N'AZN';
END
GO

IF COL_LENGTH('orders', 'vat') IS NULL
BEGIN
    ALTER TABLE orders ADD vat DECIMAL(10, 2) NOT NULL DEFAULT 0;
    ALTER TABLE orders ADD service_fee DECIMAL(10, 2) NOT NULL DEFAULT 0;
    ALTER TABLE orders ADD delivery_fee DECIMAL(10, 2) NOT NULL DEFAULT 0;
    ALTER TABLE orders ADD currency NVARCHAR(3) NOT NULL DEFAULT N'AZN';
END
GO
