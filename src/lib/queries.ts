import { all, get, run, insert, batch, type Stmt } from "./db.ts";
import { evaluateRule, avgKmPerDay, type RuleResult } from "./rules.ts";
import { today } from "./util.ts";
import { COST_ONLY, categoryRank, keywordsFor } from "./parts.ts";
import type { DistanceUnit } from "./format.ts";

export interface Vehicle {
  id: number; name: string; plate: string | null; model: string | null; year: number | null; odo: number; fuel: string | null;
}
export interface PartType {
  id: number; key: string | null; name: string; category: string; default_km: number | null; default_months: number | null;
}
export interface RuleRow extends RuleResult {
  ruleId: number; vehicleId: number; partTypeId: number; partKey: string | null; partName: string; category: string;
  intervalKm: number | null; intervalMonths: number | null; enabled: boolean;
  source: string; sourceNote: string | null; sourceUrl: string | null;
  last: { date: string; odo: number | null; garage: string | null; amount: number } | null;
}

export const listVehicles = () => all<Vehicle>("SELECT * FROM vehicles ORDER BY id");
export const getVehicle = (id: number) => get<Vehicle>("SELECT * FROM vehicles WHERE id = ?", id);
export interface PartTypeKw extends PartType { kw: string[] }
export const listPartTypes = async (): Promise<PartTypeKw[]> =>
  (await all<PartType>("SELECT * FROM part_types ORDER BY id"))
    .sort((a, b) => categoryRank(a.category) - categoryRank(b.category) || a.id - b.id)
    .map((p) => ({ ...p, kw: keywordsFor(p.name) }));

/** Linh kiện không áp dụng cho từng loại nhiên liệu (tự tắt theo dõi khi tạo xe; bật lại được trong trang xe). */
const NOT_APPLICABLE: Record<string, string[]> = {
  diesel: ["spark_plugs"],
  electric: ["engine_oil", "oil_filter", "air_filter", "fuel_filter", "spark_plugs", "drive_belt", "injector_cleaning"],
};

export async function createVehicle(v: Omit<Vehicle, "id">, opts: { distance: DistanceUnit } = { distance: "km" }): Promise<number> {
  const id = await insert(
    "INSERT INTO vehicles (name, plate, model, year, odo, fuel) VALUES (?,?,?,?,?,?)",
    v.name, v.plate, v.model, v.year, v.odo, v.fuel,
  );
  // chu kỳ mặc định tính theo km; nếu dùng dặm thì quy đổi và làm tròn tới 500
  const km = opts.distance === "mi" ? "CAST(ROUND(default_km * 0.621371 / 500.0) * 500 AS INTEGER)" : "default_km";
  const off = NOT_APPLICABLE[v.fuel ?? ""] ?? [];
  await batch([
    [`INSERT INTO rules (vehicle_id, part_type_id, interval_km, interval_months, enabled)
      SELECT ?, id, ${km}, default_months, CASE WHEN key IN (${off.map(() => "?").join(",") || "NULL"}) THEN 0 ELSE 1 END
      FROM part_types WHERE category <> ?`, id, ...off, COST_ONLY],
    ...(v.odo > 0 ? [["INSERT INTO odometer_logs (vehicle_id, km, date) VALUES (?,?,?)", id, v.odo, today()] as Stmt] : []),
  ]);
  return id;
}

/**
 * Cập nhật odo hiện tại và ghi lịch sử (một transaction).
 * Phiếu cũ (ODO thấp hơn) không được kéo ODO hiện tại lùi; người dùng tự nhập/sửa thì được (override).
 */
export const setOdoStmts = (vehicleId: number, km: number, date = today(), override = false): Stmt[] => [
  ["INSERT INTO odometer_logs (vehicle_id, km, date) VALUES (?,?,?)", vehicleId, km, date],
  ["UPDATE vehicles SET odo = ? WHERE id = ? AND (? = 1 OR ? >= odo)", km, vehicleId, override ? 1 : 0, km],
];
export const setOdo = (vehicleId: number, km: number, date = today(), override = false): Promise<void> =>
  batch(setOdoStmts(vehicleId, km, date, override));

export async function vehicleAvgKmPerDay(vehicleId: number): Promise<number> {
  const pts = await all<{ date: string; km: number }>(
    "SELECT date, km FROM odometer_logs WHERE vehicle_id = ?", vehicleId,
  );
  return avgKmPerDay(pts, today());
}

export async function vehicleRules(vehicleId: number): Promise<RuleRow[]> {
  const v = await getVehicle(vehicleId);
  if (!v) return [];
  const avg = await vehicleAvgKmPerDay(vehicleId);
  const t = today();
  const rules = await all<{
    id: number; part_type_id: number; interval_km: number | null; interval_months: number | null;
    enabled: number; key: string | null; name: string; category: string; source: string; source_note: string | null; source_url: string | null;
  }>(
    `SELECT r.id, r.part_type_id, r.interval_km, r.interval_months, r.enabled, r.source, r.source_note, r.source_url, p.key, p.name, p.category
     FROM rules r JOIN part_types p ON p.id = r.part_type_id WHERE r.vehicle_id = ?
     ORDER BY p.id`, vehicleId,
  );
  // một truy vấn cho mọi linh kiện (trước đây: 1 truy vấn / linh kiện → ~40 lần mỗi lần mở trang)
  const lastRows = await all<{ part_type_id: number; date: string; odo: number | null; garage: string | null; amount: number }>(
    `SELECT part_type_id, date, odo, garage, amount FROM (
       SELECT i.part_type_id, s.date, s.odo, g.name AS garage, i.amount,
              ROW_NUMBER() OVER (PARTITION BY i.part_type_id ORDER BY s.date DESC, COALESCE(s.odo, 0) DESC, s.id DESC) AS rn
       FROM service_items i JOIN service_records s ON s.id = i.record_id
       LEFT JOIN garages g ON g.id = s.garage_id
       WHERE s.vehicle_id = ? AND i.part_type_id IS NOT NULL
     ) WHERE rn = 1`,
    vehicleId,
  );
  const lastBy = new Map(lastRows.map((l) => [l.part_type_id, l]));
  rules.sort((a, b) => categoryRank(a.category) - categoryRank(b.category) || a.id - b.id);
  return rules.map((r) => {
    const last = lastBy.get(r.part_type_id);
    const res = evaluateRule({
      intervalKm: r.interval_km, intervalMonths: r.interval_months,
      last: last ? { date: last.date, odo: last.odo } : null,
      vehicleOdo: v.odo, today: t, avgKmPerDay: avg,
    });
    return {
      ...res, ruleId: r.id, vehicleId, partTypeId: r.part_type_id, partKey: r.key, partName: r.name,
      category: r.category, intervalKm: r.interval_km, intervalMonths: r.interval_months,
      enabled: !!r.enabled, last: last ? { date: last.date, odo: last.odo, garage: last.garage, amount: last.amount } : null,
      source: r.source, sourceNote: r.source_note, sourceUrl: r.source_url,
    };
  });
}

export async function activeAlerts(vehicleId: number) {
  return (await vehicleRules(vehicleId))
    .filter((r) => r.enabled && (r.status === "overdue" || r.status === "soon"))
    .sort((a, b) => a.urgency - b.urgency);
}

export async function upsertGarage(name: string): Promise<number | null> {
  const n = name.trim();
  if (!n) return null;
  await run("INSERT INTO garages (name) VALUES (?) ON CONFLICT (name) DO NOTHING", n);
  return (await get<{ id: number }>("SELECT id FROM garages WHERE name = ?", n))!.id;
}

export async function recordsFor(vehicleId?: number) {
  return all<{
    id: number; vehicle_id: number; vehicle: string; date: string; odo: number | null;
    total: number; garage: string | null; note: string | null; items: number;
  }>(
    `SELECT s.id, s.vehicle_id, v.name AS vehicle, s.date, s.odo, s.total, g.name AS garage, s.note,
            (SELECT COUNT(*) FROM service_items WHERE record_id = s.id) AS items
     FROM service_records s JOIN vehicles v ON v.id = s.vehicle_id
     LEFT JOIN garages g ON g.id = s.garage_id
     ${vehicleId ? "WHERE s.vehicle_id = ?" : ""}
     ORDER BY s.date DESC, s.id DESC`,
    ...(vehicleId ? [vehicleId] : []),
  );
}
