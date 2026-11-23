import { all, get, run, insert, batch, type Stmt } from "./db.ts";
import { evaluateRule, avgKmPerDay, type RuleResult } from "./rules.ts";
import { today } from "./util.ts";
import { COST_ONLY, keywordsFor } from "./parts.ts";

export interface Vehicle {
  id: number; name: string; plate: string | null; model: string | null; year: number | null; odo: number;
}
export interface PartType {
  id: number; name: string; category: string; default_km: number | null; default_months: number | null;
}
export interface RuleRow extends RuleResult {
  ruleId: number; vehicleId: number; partTypeId: number; partName: string; category: string;
  intervalKm: number | null; intervalMonths: number | null; enabled: boolean;
  source: string; sourceNote: string | null; sourceUrl: string | null;
  last: { date: string; odo: number | null; garage: string | null; amount: number } | null;
}

export const listVehicles = () => all<Vehicle>("SELECT * FROM vehicles ORDER BY id");
export const getVehicle = (id: number) => get<Vehicle>("SELECT * FROM vehicles WHERE id = ?", id);
export interface PartTypeKw extends PartType { kw: string[] }
export const listPartTypes = async (): Promise<PartTypeKw[]> =>
  (await all<PartType>("SELECT * FROM part_types ORDER BY (category = ?), category, name", COST_ONLY)).map((p) => ({ ...p, kw: keywordsFor(p.name) }));

export async function createVehicle(v: Omit<Vehicle, "id">): Promise<number> {
  const id = await insert(
    "INSERT INTO vehicles (name, plate, model, year, odo) VALUES (?,?,?,?,?)",
    v.name, v.plate, v.model, v.year, v.odo,
  );
  await batch([
    [`INSERT INTO rules (vehicle_id, part_type_id, interval_km, interval_months)
      SELECT ?, id, default_km, default_months FROM part_types WHERE category <> ?`, id, COST_ONLY],
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
    enabled: number; name: string; category: string; source: string; source_note: string | null; source_url: string | null;
  }>(
    `SELECT r.id, r.part_type_id, r.interval_km, r.interval_months, r.enabled, r.source, r.source_note, r.source_url, p.name, p.category
     FROM rules r JOIN part_types p ON p.id = r.part_type_id WHERE r.vehicle_id = ?
     ORDER BY p.category, p.name`, vehicleId,
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
  return rules.map((r) => {
    const last = lastBy.get(r.part_type_id);
    const res = evaluateRule({
      intervalKm: r.interval_km, intervalMonths: r.interval_months,
      last: last ? { date: last.date, odo: last.odo } : null,
      vehicleOdo: v.odo, today: t, avgKmPerDay: avg,
    });
    return {
      ...res, ruleId: r.id, vehicleId, partTypeId: r.part_type_id, partName: r.name,
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
