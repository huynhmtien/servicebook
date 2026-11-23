import { all, batch, type Param, type Stmt } from "./db.ts";

/** Columns of each table that is backed up/restored (fixed list: column names never come from the user's file). */
const COLS = {
  garages: ["id", "name", "address", "note"],
  vehicles: ["id", "name", "plate", "model", "year", "odo", "fuel", "created_at"],
  odometer_logs: ["id", "vehicle_id", "km", "date"],
  rules: ["id", "vehicle_id", "part_type_id", "interval_km", "interval_months", "enabled", "source", "source_note", "source_url"],
  service_records: ["id", "vehicle_id", "garage_id", "date", "odo", "total", "note", "subtotal", "discount", "vat", "vat_rate", "vat_included", "created_at"],
  service_items: ["id", "record_id", "part_type_id", "raw_name", "qty", "amount", "unit_price", "kind"],
  part_aliases: ["alias", "part_type_id"],
} as const;
type Table = keyof typeof COLS;
const ORDER: Table[] = ["garages", "vehicles", "odometer_logs", "rules", "service_records", "service_items", "part_aliases"];
type Row = Record<string, unknown>;

export async function buildBackup() {
  const data: Record<string, Row[]> = { part_types: await all<Row>("SELECT id, key, name, category FROM part_types") };
  for (const t of ORDER) data[t] = await all<Row>(`SELECT ${COLS[t].join(", ")} FROM ${t}`);
  return { app: "servicebook", version: 1, exported_at: new Date().toISOString(), data };
}

const asParam = (v: unknown): Param => (v == null ? null : typeof v === "number" || typeof v === "string" ? v : typeof v === "boolean" ? (v ? 1 : 0) : null);
const rowsOf = (d: Record<string, unknown>, t: string): Row[] => {
  const v = d[t];
  if (!Array.isArray(v)) throw new Error(`missing table ${t}`);
  return v as Row[];
};

/**
 * Restore: REPLACES all vehicles/records/intervals with the file's contents. Checks integrity before deleting anything.
 * Parts are matched by `key` (or name), so they don't depend on ids from the old installation.
 */
export async function restoreBackup(text: string): Promise<{ vehicles: number; records: number }> {
  const j = JSON.parse(text) as { app?: string; version?: number; data?: Record<string, unknown> };
  if (j.app !== "servicebook" || j.version !== 1 || !j.data || typeof j.data !== "object") throw new Error("not a ServiceBook backup");
  const d = j.data;

  // old part id → current id
  const cur = await all<{ id: number; key: string | null; name: string }>("SELECT id, key, name FROM part_types");
  const byKey = new Map(cur.filter((c) => c.key).map((c) => [c.key!, c.id]));
  const byName = new Map(cur.map((c) => [c.name, c.id]));
  const ptMap = new Map<number, number>();
  for (const p of rowsOf(d, "part_types")) {
    const id = (p.key ? byKey.get(String(p.key)) : undefined) ?? byName.get(String(p.name));
    if (id != null) ptMap.set(Number(p.id), id);
  }
  const mapPart = (v: unknown): number | null => (v == null ? null : ptMap.get(Number(v)) ?? null);

  const t = Object.fromEntries(ORDER.map((n) => [n, rowsOf(d, n)])) as Record<Table, Row[]>;
  const ids = (n: Table) => new Set(t[n].map((r) => Number(r.id)));
  const vIds = ids("vehicles"), gIds = ids("garages"), rIds = ids("service_records");
  for (const r of t.odometer_logs) if (!vIds.has(Number(r.vehicle_id))) throw new Error("broken reference: odometer_logs");
  for (const r of t.rules) if (!vIds.has(Number(r.vehicle_id))) throw new Error("broken reference: rules");
  for (const r of t.service_records) {
    if (!vIds.has(Number(r.vehicle_id))) throw new Error("broken reference: service_records");
    if (r.garage_id != null && !gIds.has(Number(r.garage_id))) throw new Error("broken reference: garage");
  }
  for (const r of t.service_items) if (!rIds.has(Number(r.record_id))) throw new Error("broken reference: service_items");

  // prepare data with parts mapped
  const rows: Record<Table, Row[]> = { ...t };
  rows.rules = t.rules.map((r) => ({ ...r, part_type_id: mapPart(r.part_type_id) })).filter((r) => r.part_type_id != null);
  rows.service_items = t.service_items.map((r) => ({ ...r, part_type_id: mapPart(r.part_type_id) }));
  rows.part_aliases = t.part_aliases.map((r) => ({ ...r, part_type_id: mapPart(r.part_type_id) })).filter((r) => r.part_type_id != null);

  const stmts: Stmt[] = [
    ["DELETE FROM vehicles"], ["DELETE FROM garages"], ["DELETE FROM part_aliases"], ["DELETE FROM drafts"],
  ];
  for (const n of ORDER) {
    const cols = COLS[n];
    const sql = `INSERT INTO ${n} (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`;
    for (const r of rows[n]) stmts.push([sql, ...cols.map((c) => asParam(r[c]))]);
  }
  // D1 batch in chunks (deletion is in the first chunk; if it fails midway, rerunning the same file fixes it since it always deletes first)
  for (let i = 0; i < stmts.length; i += 300) await batch(stmts.slice(i, i + 300));
  return { vehicles: rows.vehicles.length, records: rows.service_records.length };
}

/** CSV with one row per item (opens in Excel/Sheets). Money is exported in the currency's major unit. */
export async function buildCsv(digits: number, currency: string): Promise<string> {
  const rows = await all<{
    date: string; vehicle: string; garage: string | null; odo: number | null; item: string; part: string | null; kind: string;
    qty: number; amount: number; unit_price: number; total: number; discount: number; vat: number;
  }>(
    `SELECT s.date, v.name AS vehicle, g.name AS garage, s.odo, i.raw_name AS item, p.name AS part, i.kind,
            i.qty, i.amount, i.unit_price, s.total, s.discount, s.vat
     FROM service_items i JOIN service_records s ON s.id = i.record_id JOIN vehicles v ON v.id = s.vehicle_id
     LEFT JOIN garages g ON g.id = s.garage_id LEFT JOIN part_types p ON p.id = i.part_type_id
     ORDER BY s.date, s.id, i.id`);
  const major = (n: number) => (n / 10 ** digits).toFixed(digits);
  const q = (v: unknown) => {
    let x = String(v ?? "");
    if (/^[=+\-@\t\r]/.test(x)) x = "'" + x; // block malicious formulas when opened in Excel
    return /[",\n\r]/.test(x) ? `"${x.replace(/"/g, '""')}"` : x;
  };
  const head = ["date", "vehicle", "garage", "odometer", "item", "part", "kind", "qty", `amount_${currency}`, `unit_price_${currency}`, `slip_total_${currency}`, `discount_${currency}`, `tax_${currency}`];
  const lines = rows.map((r) => [r.date, r.vehicle, r.garage, r.odo, r.item, r.part, r.kind, r.qty, major(r.amount), major(r.unit_price), major(r.total), major(r.discount), major(r.vat)].map(q).join(","));
  return "﻿" + [head.join(","), ...lines].join("\r\n") + "\r\n";
}
