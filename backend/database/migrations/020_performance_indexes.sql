-- Migration 020: performans indeksləri (QA F25).
-- Bu sütunlar admin/mətbəx/müştəri ekranlarında HƏR sorğuda filtr/join olaraq istifadə olunur, amma indeksi yox idi:
-- indi az məlumatla fərq görünmür, amma sifariş/məhsul sayı artdıqca cədvəl skani halına gəlirdi.
USE qr_menu;
GO

-- order_items: hər sifariş detalı/canlı siyahı sorğusu "WHERE order_id = @id" edir (orderRepository.findById, findAll)
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_order_items_order' AND object_id = OBJECT_ID('order_items'))
    CREATE INDEX IX_order_items_order ON order_items (order_id);
GO

-- orders: admin lövhəsi/mətbəx ekranı status filtri + "ORDER BY created_at DESC" ilə açılır (orderRepository.findAll)
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_orders_status_created' AND object_id = OBJECT_ID('orders'))
    CREATE INDEX IX_orders_status_created ON orders (status, created_at DESC);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_orders_table' AND object_id = OBJECT_ID('orders'))
    CREATE INDEX IX_orders_table ON orders (table_id) WHERE table_id IS NOT NULL;
GO

-- products: müştəri menyusu və admin siyahısı "WHERE category_id = @id" ilə süzür
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_products_category' AND object_id = OBJECT_ID('products'))
    CREATE INDEX IX_products_category ON products (category_id);
GO

-- notifications: bildiriş zəngi "unread count" və panel siyahısını hər socket hadisəsində/açılışda sorğulayır
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_notifications_restaurant_read' AND object_id = OBJECT_ID('notifications'))
    CREATE INDEX IX_notifications_restaurant_read ON notifications (restaurant_id, is_read, created_at DESC);
GO

-- stock_movements: InventoryAdmin "son hərəkətlər" siyahısı və məhsul üzrə tarixçə
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_stock_movements_product' AND object_id = OBJECT_ID('stock_movements'))
    CREATE INDEX IX_stock_movements_product ON stock_movements (product_id, created_at DESC);
GO

-- promo_usage: promo kodun neçə dəfə istifadə olunduğunu saymaq (promoService.validate)
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_promo_usage_code' AND object_id = OBJECT_ID('promo_usage'))
    CREATE INDEX IX_promo_usage_code ON promo_usage (promo_code_id);
GO
