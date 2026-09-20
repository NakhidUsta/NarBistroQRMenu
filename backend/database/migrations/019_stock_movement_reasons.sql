-- Migration 019: stok hərəkəti səbəbləri (QA tapıntısı F13).
-- paymentService vaxtı keçmiş onlayn sifarişi ləğv edəndə stok_movements-ə 'order_expired' yazırdı, lakin CHECK məhdudiyyəti yalnız
-- restock/order/manual_adjustment qəbul edirdi → INSERT uğursuz olur, bütün ləğv əməliyyatı geri qaytarılırdı (sifariş NEW qalır, stok sonsuza qədər bloklanırdı).
-- İndi 'order_expired' (ödəniş vaxtı bitdi) və 'order_cancelled' (işçi ləğv etdi, stok qaytarıldı) da icazəlidir.
USE qr_menu;
GO

DECLARE @ck NVARCHAR(200) = (
    SELECT TOP 1 cc.name FROM sys.check_constraints cc
    WHERE cc.parent_object_id = OBJECT_ID('stock_movements') AND cc.definition LIKE '%reason%'
);
IF @ck IS NOT NULL EXEC (N'ALTER TABLE stock_movements DROP CONSTRAINT ' + @ck);
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_stock_movements_reason' AND parent_object_id = OBJECT_ID('stock_movements'))
    ALTER TABLE stock_movements ADD CONSTRAINT CK_stock_movements_reason
        CHECK (reason IN (N'restock', N'order', N'manual_adjustment', N'order_expired', N'order_cancelled'));
GO
