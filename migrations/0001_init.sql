-- ServiceBook: schema D1 (SQLite). Ngày giữ dạng TEXT 'YYYY-MM-DD'; tiền là số nguyên VNĐ.
CREATE TABLE vehicles (
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, plate TEXT, model TEXT, year INTEGER,
  odo INTEGER NOT NULL DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE odometer_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT, vehicle_id INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  km INTEGER NOT NULL, date TEXT NOT NULL);
CREATE INDEX idx_odo_vehicle ON odometer_logs(vehicle_id, date);

CREATE TABLE part_types (
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, category TEXT NOT NULL,
  default_km INTEGER, default_months INTEGER);

CREATE TABLE rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT, vehicle_id INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  part_type_id INTEGER NOT NULL REFERENCES part_types(id) ON DELETE CASCADE,
  interval_km INTEGER, interval_months INTEGER, enabled INTEGER NOT NULL DEFAULT 1,
  source TEXT NOT NULL DEFAULT 'default', source_note TEXT, source_url TEXT,
  UNIQUE (vehicle_id, part_type_id));

CREATE TABLE garages (
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, address TEXT, note TEXT);

CREATE TABLE service_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT, vehicle_id INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  garage_id INTEGER REFERENCES garages(id) ON DELETE SET NULL,
  date TEXT NOT NULL, odo INTEGER, total INTEGER NOT NULL DEFAULT 0, note TEXT, image_path TEXT,
  subtotal INTEGER, discount INTEGER NOT NULL DEFAULT 0, vat INTEGER NOT NULL DEFAULT 0,
  vat_rate REAL, vat_included INTEGER NOT NULL DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX idx_records_vehicle ON service_records(vehicle_id, date);
CREATE INDEX idx_records_garage ON service_records(garage_id);

CREATE TABLE service_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT, record_id INTEGER NOT NULL REFERENCES service_records(id) ON DELETE CASCADE,
  part_type_id INTEGER REFERENCES part_types(id) ON DELETE SET NULL,
  raw_name TEXT NOT NULL, qty REAL NOT NULL DEFAULT 1, amount INTEGER NOT NULL DEFAULT 0,
  unit_price INTEGER NOT NULL DEFAULT 0, kind TEXT NOT NULL DEFAULT 'part');
CREATE INDEX idx_items_part ON service_items(part_type_id);
CREATE INDEX idx_items_record ON service_items(record_id);

CREATE TABLE part_aliases (
  alias TEXT PRIMARY KEY, part_type_id INTEGER NOT NULL REFERENCES part_types(id) ON DELETE CASCADE);

CREATE TABLE drafts (
  id INTEGER PRIMARY KEY AUTOINCREMENT, vehicle_id INTEGER, image_path TEXT, data TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE notifications (key TEXT PRIMARY KEY, sent_at TEXT DEFAULT CURRENT_TIMESTAMP);

-- chống dò mật khẩu: đếm lần sai theo địa chỉ IP
CREATE TABLE login_fails (ip TEXT PRIMARY KEY, n INTEGER NOT NULL DEFAULT 0, last_at INTEGER NOT NULL DEFAULT 0);
