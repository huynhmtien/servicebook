// Sinh migrations/0002_seed_parts.sql từ DEFAULT_PARTS. Chạy: npm run gen:seed
// Khi thêm linh kiện mới vào parts.ts: viết migration mới (INSERT OR IGNORE + bổ sung rules) — test parts.test.ts sẽ báo nếu quên.
import { writeFileSync } from "node:fs";
import { DEFAULT_PARTS, COST_ONLY } from "../src/lib/parts.ts";

const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
const n = (v: number | null) => (v == null ? "NULL" : String(v));
const lines = DEFAULT_PARTS.map((p) => `  (${q(p.name)}, ${q(p.category)}, ${n(p.km)}, ${n(p.months)})`).join(",\n");
const sql = `-- Danh mục linh kiện chuẩn (sinh từ src/lib/parts.ts bằng scripts/gen-seed.ts)
INSERT OR IGNORE INTO part_types (name, category, default_km, default_months) VALUES
${lines};

-- xe đã có từ trước (nếu có): bổ sung rule cho linh kiện chưa có
INSERT OR IGNORE INTO rules (vehicle_id, part_type_id, interval_km, interval_months)
  SELECT v.id, p.id, p.default_km, p.default_months FROM vehicles v CROSS JOIN part_types p WHERE p.category <> ${q(COST_ONLY)};
`;
writeFileSync(new URL("../migrations/0002_seed_parts.sql", import.meta.url), sql);
console.log(`Đã ghi ${DEFAULT_PARTS.length} linh kiện`);
