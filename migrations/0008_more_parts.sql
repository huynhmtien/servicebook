-- More standard parts (esp. manual-gearbox / diesel items that were missing → AI/keywords filed them under "Other").
-- Intervals are intentionally empty: wear items have no honest generic interval; set them from the manual or the AI lookup.
INSERT OR IGNORE INTO part_types (key, name, category, default_km, default_months) VALUES
  ('timing_belt', 'Timing belt / chain', 'engine', NULL, NULL),
  ('water_pump', 'Water pump', 'engine', NULL, NULL),
  ('glow_plugs', 'Glow plugs (diesel)', 'engine', NULL, NULL),
  ('clutch', 'Clutch (disc / pressure plate / release bearing)', 'drivetrain', NULL, NULL),
  ('flywheel', 'Flywheel', 'drivetrain', NULL, NULL),
  ('drive_shafts', 'Drive shafts / CV joints & boots', 'drivetrain', NULL, NULL),
  ('power_steering_fluid', 'Power steering fluid', 'chassis', NULL, NULL),
  ('wheel_bearings', 'Wheel bearings', 'chassis', NULL, NULL),
  ('radiator_hoses', 'Radiator / coolant hoses', 'cooling', NULL, NULL),
  ('alternator_starter', 'Alternator / starter', 'electrical', NULL, NULL);

-- Track the new parts on existing vehicles (clutch/flywheel only if the gearbox is manual or unknown; glow plugs only on diesel or unknown fuel).
INSERT INTO rules (vehicle_id, part_type_id, interval_km, interval_months, enabled)
SELECT v.id, p.id, p.default_km, p.default_months,
       CASE WHEN p.key IN ('clutch','flywheel') AND v.transmission IN ('automatic','cvt','dct') THEN 0
            WHEN p.key = 'glow_plugs' AND v.fuel IN ('petrol','hybrid','electric') THEN 0
            ELSE 1 END
FROM vehicles v CROSS JOIN part_types p
WHERE p.key IN ('timing_belt', 'water_pump', 'glow_plugs', 'clutch', 'flywheel', 'drive_shafts', 'power_steering_fluid', 'wheel_bearings', 'radiator_hoses', 'alternator_starter')
  AND NOT EXISTS (SELECT 1 FROM rules r WHERE r.vehicle_id = v.id AND r.part_type_id = p.id);
