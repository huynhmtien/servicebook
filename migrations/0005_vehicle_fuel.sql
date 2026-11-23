-- Loại nhiên liệu của xe (diesel / petrol / hybrid / electric): dùng để bật/tắt các linh kiện không áp dụng khi tạo xe.
ALTER TABLE vehicles ADD COLUMN fuel TEXT;
