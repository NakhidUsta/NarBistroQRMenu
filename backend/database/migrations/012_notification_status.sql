-- Migration 012: bildirişlərdə iş statusu (Call Waiter / Request Bill: OPEN → ACCEPTED → RESOLVED) və yeni növlər (out_of_stock, system_error)
SET QUOTED_IDENTIFIER ON;
GO
USE qr_menu;
GO

IF COL_LENGTH('notifications', 'status') IS NULL
    ALTER TABLE notifications ADD status NVARCHAR(20) NOT NULL CONSTRAINT DF_notifications_status DEFAULT N'OPEN';
GO
IF COL_LENGTH('notifications', 'handled_by') IS NULL
    ALTER TABLE notifications ADD handled_by INT NULL
        CONSTRAINT FK_notifications_handled_by FOREIGN KEY REFERENCES admin_users(id) ON DELETE SET NULL;
GO
IF COL_LENGTH('notifications', 'handled_at') IS NULL
    ALTER TABLE notifications ADD handled_at DATETIME2 NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_notifications_status')
    ALTER TABLE notifications ADD CONSTRAINT CK_notifications_status CHECK (status IN (N'OPEN', N'ACCEPTED', N'RESOLVED'));
GO

-- növ yoxlamasını genişləndir (köhnə, avtomatik adlı CHECK silinir)
DECLARE @old sysname = (
    SELECT TOP 1 name FROM sys.check_constraints
    WHERE parent_object_id = OBJECT_ID('notifications') AND definition LIKE '%order_created%' AND name <> 'CK_notifications_type'
);
IF @old IS NOT NULL EXEC('ALTER TABLE notifications DROP CONSTRAINT ' + @old);
GO
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_notifications_type')
    ALTER TABLE notifications ADD CONSTRAINT CK_notifications_type
        CHECK (type IN (N'order_created', N'call_waiter', N'request_bill', N'low_stock', N'out_of_stock', N'system_error'));
GO

-- artıq oxunmuş köhnə çağırışlar açıq qalmasın
UPDATE notifications SET status = N'RESOLVED' WHERE type IN (N'call_waiter', N'request_bill') AND is_read = 1 AND status = N'OPEN';
GO
