import { all } from "./db.ts";
import { COST_ONLY } from "./parts.ts";
import { claudeCall, claudeText, geminiCall, parseJson, providerOrder, visionJson, type AiCtx, type Provider } from "./extract.ts";

export interface IntervalItem {
  part_type_id: number; interval_km: number | null; interval_months: number | null;
  note: string; source_url: string | null; confidence: "high" | "medium" | "low";
}
export interface IntervalProposal {
  kind: "intervals"; vehicle_id: number; origin: "ai" | "doc"; provider: Provider | string;
  vehicle_desc: string; sources: { title: string; url: string }[]; caveats: string; items: IntervalItem[];
}

const shape = (c: AiCtx) => `{
  "vehicle_desc": string (the vehicle/engine/model year these numbers apply to),
  "caveats": string (notes: operating conditions, differences by engine, anything uncertain — write in ${c.languageName}),
  "items": [ { "part_type_id": integer, "interval_km": integer|null (distance between replacements, in ${c.unit}), "interval_months": integer|null (months between replacements),
               "note": string (e.g. normal conditions 10,000; severe 5,000 — write in ${c.languageName}), "source_url": string|null,
               "confidence": "high"|"medium"|"low" } ]
}`;

/** AI with web search capability: Claude (web_search) or Gemini (Google Search grounding). DeepSeek has none. */
export const researchProviders = (): Provider[] => providerOrder().filter((p) => p === "claude" || p === "gemini");

export async function trackedParts() {
  return all<{ id: number; name: string }>("SELECT id, name FROM part_types WHERE category <> ? ORDER BY id", COST_ONLY);
}

const intOrNull = (v: unknown, max: number): number | null => {
  const n = Number(String(v ?? "").replace(/[.,\s]/g, ""));
  return Number.isFinite(n) && n > 0 && n <= max ? Math.round(n) : null;
};

/** Coerce AI results to the standard type; drop odd rows or rows with no numbers. */
export function normalizeProposal(raw: unknown, valid: Set<number>, meta: { vehicle_id: number; origin: "ai" | "doc"; provider: string; sources: { title: string; url: string }[] }): IntervalProposal {
  const r = (raw ?? {}) as Record<string, unknown>;
  const seen = new Set<number>();
  const items: IntervalItem[] = [];
  for (const x of (Array.isArray(r.items) ? r.items : []) as Record<string, unknown>[]) {
    const id = Number(x.part_type_id);
    if (!valid.has(id) || seen.has(id)) continue;
    const km = intOrNull(x.interval_km, 500000), mo = intOrNull(x.interval_months, 120);
    if (km == null && mo == null) continue;
    seen.add(id);
    const c = String(x.confidence ?? "").toLowerCase();
    const url = typeof x.source_url === "string" && /^https?:\/\//.test(x.source_url) ? x.source_url : null;
    items.push({ part_type_id: id, interval_km: km, interval_months: mo, note: String(x.note ?? "").slice(0, 300), source_url: url, confidence: c === "high" || c === "low" ? c : "medium" });
  }
  return { kind: "intervals", ...meta, vehicle_desc: String(r.vehicle_desc ?? "").slice(0, 200), caveats: String(r.caveats ?? "").slice(0, 600), items };
}

function researchPrompt(desc: string, parts: { id: number; name: string }[], c: AiCtx): string {
  return (
    `MAINTENANCE INTERVAL TABLE — search the web for the OFFICIAL maintenance schedule of the manufacturer for this vehicle: ${desc}.\n` +
    `Prefer, in order: the manufacturer's owner's manual / service book (right model year, right market if available), ` +
    `the manufacturer's official site or an authorized dealer, then other reputable sources.\n\n` +
    `Parts to fill in (id: name):\n${parts.map((p) => `${p.id}: ${p.name}`).join("\n")}\n\n` +
    `Rules: ONLY fill in a part when a source clearly states its interval; if there is no source, SKIP it — never guess. ` +
    `Report distances in ${c.unit} (convert if the source uses another unit). ` +
    `"confidence" = "high" only when quoted from the manufacturer's official document for this exact vehicle; "medium" for dealer/reputable sources; "low" when inferred or from a similar vehicle. ` +
    `If the manufacturer gives both normal and severe conditions (traffic, dust, bad roads, short trips) use the normal value as the main number and mention severe in "note". ` +
    `Give each item the "source_url" of the page used. If the vehicle has several engine/gearbox variants and you don't know which one, say so in "caveats".`
  );
}

async function searchClaude(prompt: string): Promise<{ text: string; sources: { title: string; url: string }[] }> {
  const messages: unknown[] = [{ role: "user", content: prompt }];
  const sources = new Map<string, string>();
  let text = "";
  for (let i = 0; i < 5; i++) {
    const res = await claudeCall({
      max_tokens: 16000, output_config: { effort: "medium" },
      tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 6 }], messages,
    });
    for (const b of res.content) {
      if (b.type === "web_search_tool_result" && Array.isArray(b.content))
        for (const r of b.content as Record<string, string>[]) if (r.type === "web_search_result" && r.url) sources.set(r.url, r.title || r.url);
    }
    text = claudeText(res);
    if (res.stop_reason !== "pause_turn") break; // pause_turn: web search not finished, resend to continue
    messages.push({ role: "assistant", content: res.content });
  }
  if (!text) throw new Error("Claude không trả về kết quả tra cứu");
  return { text, sources: [...sources].map(([url, title]) => ({ title, url })) };
}

async function searchGemini(prompt: string, shape: string): Promise<{ text: string; sources: { title: string; url: string }[] }> {
  return geminiCall({
    contents: [{ parts: [{ text: `${prompt}\n\nAfter researching, return ONLY JSON of exactly this shape (no explanations):\n${shape}` }] }],
    tools: [{ google_search: {} }],
    generationConfig: { temperature: 0 },
  });
}

/** Look up standard intervals for the vehicle model. The result is only a SUGGESTION — the user must confirm. */
export async function researchIntervals(vehicle: { id: number; name: string; model: string | null; year: number | null }, ctx: AiCtx): Promise<IntervalProposal> {
  const providers = researchProviders();
  if (!providers.length) throw new Error(ctx.t("ai.research_needs_key"));
  const desc = [vehicle.model || vehicle.name, vehicle.year ? `(${vehicle.year})` : ""].filter(Boolean).join(" ");
  const parts = await trackedParts();
  const prompt = researchPrompt(desc, parts, ctx);
  const errors: string[] = [];
  for (const provider of providers) {
    try {
      const { text, sources } = await (provider === "claude" ? searchClaude(prompt) : searchGemini(prompt, shape(ctx)));
      const p = normalizeProposal(parseJson(text), new Set(parts.map((x) => x.id)), { vehicle_id: vehicle.id, origin: "ai", provider, sources });
      if (!p.items.length) throw new Error(ctx.t("ai.no_sourced"));
      return p;
    } catch (e) {
      errors.push(`${provider}: ${e instanceof Error ? e.message : e}`);
    }
  }
  throw new Error(errors.join(" | "));
}

/** Read the maintenance table photographed from the vehicle's owner's manual / warranty book. */
export async function extractIntervalsFromDoc(vehicle: { id: number }, file: Buffer, mime: string, ctx: AiCtx): Promise<IntervalProposal> {
  const order = providerOrder();
  if (!order.length) throw new Error(ctx.t("ai.no_key"));
  const parts = await trackedParts();
  const prompt =
    `This is a photo/PDF of the MAINTENANCE INTERVAL TABLE from a car's owner's manual / service book (any language). ` +
    `Read the table and convert it into an interval per part (distance between replacements/inspections in ${ctx.unit}, and/or months). ` +
    `If the table marks milestones (10,000, 20,000, ... ) the interval is the distance between marked milestones. ` +
    `Only fill in parts that appear in the table; never guess. "confidence" = "high" when clearly legible, "low" when blurry/unsure. "source_url" = null.\n\n` +
    `Parts (id: name):\n${parts.map((p) => `${p.id}: ${p.name}`).join("\n")}`;
  const errors: string[] = [];
  for (const provider of order) {
    try {
      const raw = await visionJson(provider, file, mime, prompt, shape(ctx));
      const p = normalizeProposal(raw, new Set(parts.map((x) => x.id)), { vehicle_id: vehicle.id, origin: "doc", provider, sources: [] });
      if (!p.items.length) throw new Error(ctx.t("ai.no_table"));
      return p;
    } catch (e) {
      errors.push(`${provider}: ${e instanceof Error ? e.message : e}`);
    }
  }
  throw new Error(errors.join(" | "));
}
