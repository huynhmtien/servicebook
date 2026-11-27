-- Vehicle variant (gearbox / engine / VIN) so the maintenance-interval lookup targets the exact car.
ALTER TABLE vehicles ADD COLUMN transmission TEXT;
ALTER TABLE vehicles ADD COLUMN engine TEXT;
ALTER TABLE vehicles ADD COLUMN vin TEXT;

-- Defect / abnormality reports: a quick photo at the moment you notice something, described by AI, kept as evidence for the garage.
-- `thumb` is a tiny WebP/JPEG data URL (<= ~50 KB) kept ONLY here; service-slip / manual / registration scans are never stored.
CREATE TABLE defects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vehicle_id INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  odo INTEGER,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  area TEXT,
  severity TEXT NOT NULL DEFAULT 'medium',
  advice TEXT,
  user_note TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  resolved_at TEXT,
  resolution TEXT,
  thumb TEXT,
  ai INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_defects_vehicle ON defects(vehicle_id, status, date);
