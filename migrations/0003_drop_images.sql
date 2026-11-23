-- ServiceBook không lưu ảnh phiếu nữa: ảnh chỉ gửi cho AI đọc rồi bỏ.
ALTER TABLE service_records DROP COLUMN image_path;
ALTER TABLE drafts DROP COLUMN image_path;
