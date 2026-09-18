-- Migration 006: müştəri rəyləri (sifarişə bağlı, admin təsdiqi ilə görünür)
USE qr_menu;
GO

IF OBJECT_ID('reviews', 'U') IS NULL
BEGIN
    CREATE TABLE reviews (
        id            INT IDENTITY(1,1) PRIMARY KEY,
        restaurant_id INT NOT NULL FOREIGN KEY REFERENCES restaurants(id),
        order_id      INT NOT NULL FOREIGN KEY REFERENCES orders(id) ON DELETE CASCADE,
        customer_name NVARCHAR(120) NOT NULL,
        rating        INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
        comment       NVARCHAR(1000) NULL,
        is_approved   BIT NOT NULL DEFAULT 0,
        created_at    DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UQ_reviews_order UNIQUE (order_id)
    );
END
GO
