import { providerOrder, visionJson, type AiCtx } from "./extract.ts";
import { FUELS, TRANSMISSIONS, oneOf } from "./vehicle-spec.ts";

const str = (v: unknown, max = 200) => { const s = String(v ?? "").replace(/\s+/g, " ").trim(); return s && !/^(null|n\/a|none|unknown|-)$/i.test(s) ? s.slice(0, max) : null; };
const intOrNull = (v: unknown) => { const n = Number(String(v ?? "").replace(/[^\d]/g, "")); return Number.isFinite(n) && n > 0 ? n : null; };

// ---------- vehicle registration / inspection / title document → vehicle fields ----------
export interface VehicleScan {
  plate: string | null; make: string | null; model: string | null; year: number | null;
  fuel: (typeof FUELS)[number] | null; transmission: (typeof TRANSMISSIONS)[number] | null; engine: string | null; vin: string | null;
}
const VEHICLE_SHAPE = `{"plate": string|null, "make": string|null, "model": string|null, "year": number|null, "fuel": "diesel"|"petrol"|"hybrid"|"electric"|null, "transmission": "manual"|"automatic"|"cvt"|"dct"|null, "engine": string|null, "vin": string|null}`;
const VEHICLE_PROMPT =
  `This is a photo of a vehicle registration certificate, inspection (roadworthiness) certificate or similar vehicle document (any language, e.g. Vietnamese "Giấy đăng ký xe / Giấy chứng nhận kiểm định / Cà vẹt"). ` +
  `Extract: "plate" (licence plate), "make" (brand, e.g. Toyota), "model" (model / trim, e.g. Fortuner 2.5G), "year" (year of manufacture), ` +
  `"fuel" (diesel/petrol/hybrid/electric; "Diesel"/"Dầu" → diesel, "Xăng" → petrol), "engine" (displacement and/or engine code, e.g. "2.5L 2KD-FTV" or "2494 cc"), ` +
  `"vin" (chassis / VIN number). "transmission" ONLY if the document states it, otherwise null. Use null for anything not clearly legible — never guess.`;

export function normalizeVehicleScan(raw: unknown): VehicleScan {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const y = intOrNull(r.year);
  return {
    plate: str(r.plate, 20)?.toUpperCase() ?? null, make: str(r.make, 40), model: str(r.model, 60),
    year: y && y >= 1950 && y <= new Date().getFullYear() + 1 ? y : null,
    fuel: oneOf(FUELS, r.fuel), transmission: oneOf(TRANSMISSIONS, r.transmission), engine: str(r.engine, 60),
    vin: str(r.vin, 30)?.toUpperCase().replace(/\s/g, "") ?? null,
  };
}

export async function extractVehicle(file: Buffer, mime: string, ctx: AiCtx): Promise<VehicleScan> {
  const order = providerOrder();
  if (!order.length) throw new Error(ctx.t("ai.no_key"));
  const errors: string[] = [];
  for (const p of order) {
    try {
      const v = normalizeVehicleScan(await visionJson(p, file, mime, VEHICLE_PROMPT, VEHICLE_SHAPE));
      if (!v.plate && !v.make && !v.model && !v.vin) throw new Error(ctx.t("ai.no_vehicle_data"));
      return v;
    } catch (e) { errors.push(`${p}: ${e instanceof Error ? e.message : e}`); }
  }
  throw new Error(errors.join(" | "));
}

// ---------- defect photo → short description for the garage ----------
export const SEVERITIES = ["low", "medium", "high"] as const;
export interface DefectScan { title: string; description: string; area: string | null; severity: (typeof SEVERITIES)[number]; advice: string | null }
const DEFECT_SHAPE = `{"title": string, "description": string, "area": string|null, "severity": "low"|"medium"|"high", "advice": string|null}`;

export function normalizeDefect(raw: unknown): DefectScan | null {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const title = str(r.title, 120);
  if (!title) return null;
  return { title, description: str(r.description, 800) ?? "", area: str(r.area, 60), severity: oneOf(SEVERITIES, r.severity) ?? "medium", advice: str(r.advice, 400) };
}

export async function describeDefect(file: Buffer, mime: string, ctx: AiCtx, vehicleDesc: string, userNote: string): Promise<DefectScan> {
  const order = providerOrder();
  if (!order.length) throw new Error(ctx.t("ai.no_key"));
  const prompt =
    `A car owner just photographed something abnormal on their vehicle (${vehicleDesc}) and wants a short written record to show a mechanic later. ` +
    `Write in ${ctx.languageName}. Describe ONLY what is visible (and what the owner's note says): ` +
    `"title" = a short name of the problem (max 10 words); "description" = 2–4 factual sentences (what, where, how it looks, extent) without speculating beyond the image; ` +
    `"area" = the affected part/system (e.g. front-left tyre, engine bay, dashboard warning light, underbody); ` +
    `"severity" = "high" if it affects safe driving or can cause further damage soon (brake/steering/tyre damage, leaks, overheating, red warning lights), "medium" if it should be checked at the next service, "low" if cosmetic or minor; ` +
    `"advice" = one cautious sentence on what to ask the garage to check, or null. If the photo shows no visible problem, say so in "description" and use severity "low". ` +
    (userNote ? `Owner's note: "${userNote.slice(0, 300)}".` : "");
  const errors: string[] = [];
  for (const p of order) {
    try {
      const d = normalizeDefect(await visionJson(p, file, mime, prompt, DEFECT_SHAPE));
      if (!d) throw new Error("empty");
      return d;
    } catch (e) { errors.push(`${p}: ${e instanceof Error ? e.message : e}`); }
  }
  throw new Error(errors.join(" | "));
}
