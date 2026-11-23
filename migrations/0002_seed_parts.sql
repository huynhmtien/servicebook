-- Danh mục linh kiện chuẩn (sinh từ src/lib/parts.ts bằng scripts/gen-seed.ts)
INSERT OR IGNORE INTO part_types (name, category, default_km, default_months) VALUES
  ('Bảo dưỡng định kỳ theo hãng', 'Định kỳ', 10000, 6),
  ('Dầu động cơ', 'Động cơ', 5000, 6),
  ('Lọc dầu động cơ', 'Động cơ', 5000, 6),
  ('Lọc gió động cơ', 'Động cơ', 15000, 12),
  ('Lọc nhiên liệu', 'Động cơ', 40000, 24),
  ('Bugi', 'Động cơ', 40000, 36),
  ('Dây curoa', 'Động cơ', 80000, 60),
  ('Nước làm mát', 'Làm mát', 40000, 24),
  ('Lọc gió điều hòa', 'Điều hòa', 15000, 12),
  ('Dầu hộp số tự động', 'Truyền động', 40000, 36),
  ('Dầu hộp số sàn / vi sai', 'Truyền động', 60000, 48),
  ('Dầu phanh', 'Phanh', 40000, 24),
  ('Má phanh trước', 'Phanh', 40000, NULL),
  ('Má phanh sau', 'Phanh', 60000, NULL),
  ('Đĩa phanh', 'Phanh', 80000, NULL),
  ('Lốp xe', 'Gầm / lốp', 50000, 60),
  ('Đảo lốp', 'Gầm / lốp', 10000, 6),
  ('Cân chỉnh góc đặt bánh', 'Gầm / lốp', 20000, 12),
  ('Giảm xóc', 'Gầm / lốp', 80000, NULL),
  ('Ắc quy', 'Điện', NULL, 24),
  ('Gạt mưa', 'Điện', NULL, 12),
  ('Đăng kiểm', 'Giấy tờ', NULL, 12),
  ('Bảo hiểm TNDS / thân vỏ', 'Giấy tờ', NULL, 12),
  ('Vệ sinh kim phun / buồng đốt', 'Động cơ', NULL, NULL),
  ('Gas điều hòa', 'Điều hòa', NULL, NULL),
  ('Bóng đèn / đèn xe', 'Điện', NULL, NULL),
  ('Rotuyn / cao su gầm', 'Gầm / lốp', NULL, NULL),
  ('Nhân công / công thợ chung', 'Chi phí khác', NULL, NULL),
  ('Rửa xe / vệ sinh xe', 'Chi phí khác', NULL, NULL),
  ('Nước rửa kính / phụ gia', 'Chi phí khác', NULL, NULL),
  ('Phụ phí / vật tư phụ khác', 'Chi phí khác', NULL, NULL),
  ('Khác (chưa phân loại)', 'Chi phí khác', NULL, NULL);

-- xe đã có từ trước (nếu có): bổ sung rule cho linh kiện chưa có
INSERT OR IGNORE INTO rules (vehicle_id, part_type_id, interval_km, interval_months)
  SELECT v.id, p.id, p.default_km, p.default_months FROM vehicles v CROSS JOIN part_types p WHERE p.category <> 'Chi phí khác';
