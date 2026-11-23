-- Internationalization: parts get a stable key + English name; categories are stored by key; settings table.
-- (Rows seeded with Vietnamese names in 0002 are converted to English keys/names; display names come from the app's language.)
ALTER TABLE part_types ADD COLUMN key TEXT;

UPDATE part_types SET key = 'periodic_service', name = 'Scheduled service (manufacturer)' WHERE name = 'Bảo dưỡng định kỳ theo hãng';
UPDATE part_types SET key = 'engine_oil', name = 'Engine oil' WHERE name = 'Dầu động cơ';
UPDATE part_types SET key = 'oil_filter', name = 'Engine oil filter' WHERE name = 'Lọc dầu động cơ';
UPDATE part_types SET key = 'air_filter', name = 'Engine air filter' WHERE name = 'Lọc gió động cơ';
UPDATE part_types SET key = 'fuel_filter', name = 'Fuel filter' WHERE name = 'Lọc nhiên liệu';
UPDATE part_types SET key = 'spark_plugs', name = 'Spark plugs' WHERE name = 'Bugi';
UPDATE part_types SET key = 'drive_belt', name = 'Drive belt' WHERE name = 'Dây curoa';
UPDATE part_types SET key = 'coolant', name = 'Coolant' WHERE name = 'Nước làm mát';
UPDATE part_types SET key = 'cabin_filter', name = 'Cabin air filter' WHERE name = 'Lọc gió điều hòa';
UPDATE part_types SET key = 'atf', name = 'Automatic transmission fluid' WHERE name = 'Dầu hộp số tự động';
UPDATE part_types SET key = 'gear_oil', name = 'Manual gearbox / differential oil' WHERE name = 'Dầu hộp số sàn / vi sai';
UPDATE part_types SET key = 'brake_fluid', name = 'Brake fluid' WHERE name = 'Dầu phanh';
UPDATE part_types SET key = 'brake_pads_front', name = 'Front brake pads' WHERE name = 'Má phanh trước';
UPDATE part_types SET key = 'brake_pads_rear', name = 'Rear brake pads' WHERE name = 'Má phanh sau';
UPDATE part_types SET key = 'brake_discs', name = 'Brake discs' WHERE name = 'Đĩa phanh';
UPDATE part_types SET key = 'tires', name = 'Tires' WHERE name = 'Lốp xe';
UPDATE part_types SET key = 'tire_rotation', name = 'Tire rotation' WHERE name = 'Đảo lốp';
UPDATE part_types SET key = 'alignment', name = 'Wheel alignment' WHERE name = 'Cân chỉnh góc đặt bánh';
UPDATE part_types SET key = 'shocks', name = 'Shock absorbers' WHERE name = 'Giảm xóc';
UPDATE part_types SET key = 'battery', name = 'Battery' WHERE name = 'Ắc quy';
UPDATE part_types SET key = 'wipers', name = 'Wiper blades' WHERE name = 'Gạt mưa';
UPDATE part_types SET key = 'inspection', name = 'Roadworthiness inspection' WHERE name = 'Đăng kiểm';
UPDATE part_types SET key = 'insurance', name = 'Insurance' WHERE name = 'Bảo hiểm TNDS / thân vỏ';
UPDATE part_types SET key = 'injector_cleaning', name = 'Injector / combustion cleaning' WHERE name = 'Vệ sinh kim phun / buồng đốt';
UPDATE part_types SET key = 'ac_gas', name = 'A/C refrigerant' WHERE name = 'Gas điều hòa';
UPDATE part_types SET key = 'bulbs', name = 'Bulbs / lights' WHERE name = 'Bóng đèn / đèn xe';
UPDATE part_types SET key = 'suspension_bushings', name = 'Ball joints / suspension bushings' WHERE name = 'Rotuyn / cao su gầm';
UPDATE part_types SET key = 'labor', name = 'General labor' WHERE name = 'Nhân công / công thợ chung';
UPDATE part_types SET key = 'car_wash', name = 'Car wash / detailing' WHERE name = 'Rửa xe / vệ sinh xe';
UPDATE part_types SET key = 'washer_fluid', name = 'Washer fluid / additives' WHERE name = 'Nước rửa kính / phụ gia';
UPDATE part_types SET key = 'misc', name = 'Misc. supplies / fees' WHERE name = 'Phụ phí / vật tư phụ khác';
UPDATE part_types SET key = 'other', name = 'Other (uncategorized)' WHERE name = 'Khác (chưa phân loại)';

UPDATE part_types SET category = 'periodic' WHERE category = 'Định kỳ';
UPDATE part_types SET category = 'engine' WHERE category = 'Động cơ';
UPDATE part_types SET category = 'cooling' WHERE category = 'Làm mát';
UPDATE part_types SET category = 'ac' WHERE category = 'Điều hòa';
UPDATE part_types SET category = 'drivetrain' WHERE category = 'Truyền động';
UPDATE part_types SET category = 'brakes' WHERE category = 'Phanh';
UPDATE part_types SET category = 'chassis' WHERE category = 'Gầm / lốp';
UPDATE part_types SET category = 'electrical' WHERE category = 'Điện';
UPDATE part_types SET category = 'documents' WHERE category = 'Giấy tờ';
UPDATE part_types SET category = 'other_costs' WHERE category = 'Chi phí khác';

CREATE UNIQUE INDEX idx_part_types_key ON part_types(key);

-- app-wide settings: language, currency, distance unit, time zone, reminder hour (see src/lib/settings.ts)
CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
