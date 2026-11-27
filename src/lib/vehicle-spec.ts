// Pure helpers: describe a vehicle precisely enough for the AI to pick the right variant.

export interface SpecInput {
  name: string; model: string | null; year: number | null; fuel: string | null; transmission: string | null; engine: string | null;
}
export const FUELS = ["diesel", "petrol", "hybrid", "electric"] as const;
export const TRANSMISSIONS = ["manual", "automatic", "cvt", "dct"] as const;
const FUEL_EN: Record<string, string> = { diesel: "diesel", petrol: "petrol (gasoline)", hybrid: "hybrid", electric: "electric (EV)" };
const TRANS_EN: Record<string, string> = { manual: "manual gearbox", automatic: "automatic transmission", cvt: "CVT", dct: "dual-clutch (DCT)" };

/** "Toyota" + name "Fortuner" → "Toyota Fortuner" (people often fill the make in one field and the model in the other). */
export function fullModel(v: Pick<SpecInput, "name" | "model">): string {
  const m = (v.model ?? "").trim(), n = v.name.trim();
  if (!m) return n;
  if (!n || m.toLowerCase().includes(n.toLowerCase())) return m;
  return `${m} ${n}`;
}

/** e.g. "Toyota Fortuner (2015), diesel, manual gearbox, 2.4L" — used in the web-search prompt and on the button. */
export function specDesc(v: SpecInput): string {
  return [
    fullModel(v) + (v.year ? ` (${v.year})` : ""),
    v.fuel && FUEL_EN[v.fuel], v.transmission && TRANS_EN[v.transmission], v.engine,
  ].filter(Boolean).join(", ");
}

export const oneOf = <T extends string>(list: readonly T[], v: unknown): T | null => {
  const s = String(v ?? "").trim().toLowerCase();
  return (list as readonly string[]).includes(s) ? (s as T) : null;
};

const ALL_NA: Record<string, string[]> = {
  diesel: ["spark_plugs"],
  petrol: ["glow_plugs"],
  hybrid: ["glow_plugs"],
  electric: ["engine_oil", "oil_filter", "air_filter", "fuel_filter", "spark_plugs", "glow_plugs", "drive_belt", "timing_belt", "water_pump", "injector_cleaning", "clutch", "flywheel", "atf", "gear_oil"],
};
/** Part keys that do not apply to this fuel / gearbox (tracking is switched off when the vehicle is created; can be re-enabled on the vehicle page). */
export function notApplicable(fuel: string | null, transmission: string | null): string[] {
  const out = new Set(ALL_NA[fuel ?? ""] ?? []);
  if (transmission === "manual") out.add("atf");
  if (transmission === "automatic" || transmission === "cvt" || transmission === "dct") { out.add("clutch"); out.add("flywheel"); }
  return [...out];
}
