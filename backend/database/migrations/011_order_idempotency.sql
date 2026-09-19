-- Migration 011: sifarişin təkrar göndərilməsindən (offline növbə, şəbəkə kəsilməsi, qoşa klik) qorunma üçün idempotency açarı
SET QUOTED_IDENTIFIER ON; -- filtrli indeks üçün lazımdır (sqlcmd defoltda OFF)
GO
USE qr_menu;
GO

IF COL_LENGTH('orders', 'client_request_id') IS NULL
    ALTER TABLE orders ADD client_request_id NVARCHAR(64) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_orders_client_request_id')
    CREATE UNIQUE INDEX UX_orders_client_request_id ON orders (client_request_id) WHERE client_request_id IS NOT NULL;
GO
