import { all, get } from "./db.ts";
import { normName } from "./util.ts";
import { GENERIC_KEY, guessPart, keywordsFor } from "./parts.ts";
import { inferVat } from "./money.ts";
import { parseAmount } from "./format.ts";
import { LANGS, type Lang, type T } from "./i18n/index.ts";
import type { I18n } from "./settings.ts";

/** Ngữ cảnh cho AI: ngôn ngữ người dùng, loại tiền, đơn vị — để prompt đúng và kết quả khớp cài đặt. */
export interface AiCtx { lang: Lang; languageName: string; locale: string; currency: string; digits: number; unit: string; taxRates: number[]; t: T }
/** Thuế suất thường gặp để app tự suy ra thuế khi AI bỏ sót (chỉ khi chênh lệch khớp rất sát). */
const TAX_RATES: Record<Lang, number[]> = { vi: [5, 8, 10], en: [5, 6, 7, 8, 10, 20] };
export const aiContext = (i: I18n): AiCtx => ({
  lang: i.lang, languageName: LANGS[i.lang].label, locale: LANGS[i.lang].locale, currency: i.fmt.currency, digits: i.fmt.digits,
  unit: i.fmt.unit, taxRates: TAX_RATES[i.lang], t: i.t,
});

export interface DraftItem {
  raw_name: string; qty: number; amount: number; kind: "part" | "labor"; part_type_id: number | null;
  /** nguồn phân loại: bộ nhớ đã xác nhận / AI / từ khóa tự động / chưa có */
  how?: "memory" | "ai" | "keyword" | null;
  confidence?: number | null;
}
export interface Draft {
  garage: string; date: string | null; odo: number | null; slip_total: number | null;
  discount: number; vat: number; vat_rate: number | null; vat_included: boolean; vat_inferred?: boolean;
  items: DraftItem[];
}

export type Provider = "claude" | "gemini" | "deepseek";

const KEYS: Record<Provider, string> = {
  claude: "ANTHROPIC_API_KEY", gemini: "GEMINI_API_KEY", deepseek: "DEEPSEEK_API_KEY",
};

/** Các nhà cung cấp có khóa, theo thứ tự thử: AI_PROVIDER (nếu đặt) trước, rồi các nhà còn lại. */
export function providerOrder(): Provider[] {
  const have = (Object.keys(KEYS) as Provider[]).filter((p) => !!process.env[KEYS[p]]);
  const want = (process.env.AI_PROVIDER || "").toLowerCase() as Provider;
  return have.includes(want) ? [want, ...have.filter((p) => p !== want)] : have;
}
export const activeProvider = (): Provider | null => providerOrder()[0] ?? null;
export const scanEnabled = () => activeProvider() !== null;

const SHAPE = `{
  "garage": string (garage / dealer / shop name, "" if not visible),
  "date": string|null (YYYY-MM-DD),
  "odo": number|null (odometer reading as an integer),
  "discount": number (total discount, positive, 0 if none),
  "vat": number (tax amount printed on the slip: VAT/GST/sales tax, 0 if none),
  "vat_rate": number|null (tax percentage if printed, e.g. 8 or 10),
  "vat_included": boolean (true if the slip says line prices ALREADY INCLUDE tax),
  "slip_total": number|null (final total paid on the slip),
  "items": [ { "raw_name": string (exactly as printed), "qty": number, "amount": number (line total),
               "kind": "part"|"labor", "part_type_id": integer, "confidence": number (0 to 1) } ]
}`;

function buildPrompt(parts: { id: number; name: string; category: string }[], c: AiCtx): string {
  return (
    `This is a vehicle maintenance / repair invoice. It may be written in any language. Extract every line item (both parts and labor). ` +
    `Money: amounts are in ${c.currency} unless the slip clearly shows another currency; write plain numbers with "." as the decimal separator and no thousands separators (e.g. 1234.5). ` +
    `Dates: output YYYY-MM-DD; if a date is ambiguous (e.g. 03/04/2026) use the convention of locale ${c.locale}. ` +
    `Odometer: report in ${c.unit}; convert if the slip uses another unit.\n\n` +
    `MONEY RULES: keep each line's "amount" exactly as printed. Do NOT put summary rows (subtotal, tax/VAT/GST, discount, total) into "items" — ` +
    `put them into "vat" (tax amount), "vat_rate", "discount" and "slip_total". If the slip says prices already include tax, set "vat_included" = true.\n\n` +
    `Standard classification list (id: name [group]):\n${parts.map((p) => `${p.id}: ${p.name} [${p.category}]`).join("\n")}\n\n` +
    `CLASSIFICATION: every line must get one "part_type_id" from the list above. A part/service line that matches a component gets that component; ` +
    `a labor line for replacing/repairing a component gets the same id as that component with kind = "labor"; general labor gets the "General labor" id; ` +
    `anything else gets "Other (uncategorized)". "confidence" is how sure you are about the classification (0–1). ` +
    `Keep "raw_name" in the original language of the slip. Do not invent data: leave a field null / 0 / "" when it is not on the slip.`
  );
}

const JSON_SCHEMA = {
  type: "object",
  properties: {
    garage: { type: "string" },
    date: { type: ["string", "null"] },
    odo: { type: ["number", "null"] },
    discount: { type: "number" },
    vat: { type: "number" },
    vat_rate: { type: ["number", "null"] },
    vat_included: { type: "boolean" },
    slip_total: { type: ["number", "null"] },
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          raw_name: { type: "string" }, qty: { type: "number" }, amount: { type: "number" },
          kind: { type: "string", enum: ["part", "labor"] }, part_type_id: { type: ["integer", "null"] },
          confidence: { type: "number" },
        },
        required: ["raw_name", "qty", "amount", "kind", "part_type_id", "confidence"],
      },
    },
  },
  required: ["garage", "date", "odo", "discount", "vat", "vat_rate", "vat_included", "slip_total", "items"],
} as const;

/** Ảnh/PDF chỉ được gửi cho AI đọc rồi bỏ — không lưu ở đâu cả. */
export const supportedMime = (m: string) => /^(image\/(jpeg|png|webp|gif)|application\/pdf)$/.test(m);

type Block = Record<string, unknown>;
const b64 = (buf: Buffer | Uint8Array) => Buffer.from(buf).toString("base64");

const media = (file: Buffer, mime: string): Block =>
  mime === "application/pdf"
    ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: b64(file) } }
    : { type: "image", source: { type: "base64", media_type: mime, data: b64(file) } };

export const CLAUDE_MODEL = () => process.env.CLAUDE_MODEL || "claude-sonnet-5-5";

export interface ClaudeResponse { content: Block[]; stop_reason: string }

/** Gọi Claude Messages API trực tiếp bằng fetch (không cần SDK → gói Worker nhỏ hơn). */
export async function claudeCall(body: Record<string, unknown>): Promise<ClaudeResponse> {
  const res = await fetch(process.env.ANTHROPIC_API_BASE || "https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY!, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: CLAUDE_MODEL(), ...body }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) throw new Error(`Claude ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return (await res.json()) as ClaudeResponse;
}
export const claudeText = (r: ClaudeResponse) =>
  r.content.filter((b) => b.type === "text").map((b) => String(b.text ?? "")).join("");

/** Claude: các model 5.x không cho ép tool_choice → để auto + dặn gọi công cụ; nếu model trả văn bản JSON thì vẫn đọc được. */
async function viaClaude(file: Buffer, mime: string, prompt: string): Promise<unknown> {
  const res = await claudeCall({
    max_tokens: 16000,
    output_config: { effort: "low" },
    tools: [{ name: "submit_service_slip", description: "Submit the data extracted from the service invoice.", input_schema: JSON_SCHEMA }],
    tool_choice: { type: "auto" },
    messages: [{ role: "user", content: [media(file, mime), { type: "text", text: `${prompt}\n\nGọi công cụ submit_service_slip để nộp kết quả.` }] }],
  });
  const block = res.content.find((b) => b.type === "tool_use");
  if (block) return block.input;
  const text = claudeText(res);
  if (!text) throw new Error("The AI returned no structured data");
  return parseJson(text);
}

/** Google đổi/ngừng model khá thường xuyên → thử lần lượt, model nào 404 thì sang model kế. */
export const GEMINI_MODELS = ["gemini-3.8-flash", "gemini-flash-latest", "gemini-2.5-flash"];
const geminiBase = () => process.env.GEMINI_API_BASE || "https://generativelanguage.googleapis.com";

export async function geminiCall(body: unknown): Promise<{ text: string; sources: { title: string; url: string }[] }> {
  const models = process.env.GEMINI_MODEL ? [process.env.GEMINI_MODEL] : GEMINI_MODELS;
  let res: Response | undefined;
  for (const model of models) {
    res = await fetch(`${geminiBase()}/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY! },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120_000),
    });
    if (res.status !== 404) break;
  }
  if (!res || !res.ok) throw new Error(`Gemini ${res?.status}: ${(await res?.text())?.slice(0, 200)}`);
  const j = (await res.json()) as any; // eslint-disable-line @typescript-eslint/no-explicit-any
  const cand = j?.candidates?.[0];
  const text = cand?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("");
  if (!text) throw new Error("Gemini returned no content");
  const chunks: { web?: { uri?: string; title?: string } }[] = cand?.groundingMetadata?.groundingChunks ?? [];
  const sources = chunks.filter((c) => c.web?.uri).map((c) => ({ title: c.web!.title ?? c.web!.uri!, url: c.web!.uri! }));
  return { text, sources };
}

async function viaGemini(file: Buffer, mime: string, prompt: string, shape = SHAPE): Promise<unknown> {
  const { text } = await geminiCall({
    contents: [{ parts: [{ inline_data: { mime_type: mime, data: b64(file) } }, { text: `${prompt}\n\nChỉ trả về JSON đúng dạng:\n${shape}` }] }],
    generationConfig: { responseMimeType: "application/json", temperature: 0 },
  });
  return parseJson(text);
}

async function viaDeepseek(file: Buffer, mime: string, prompt: string, shape = SHAPE): Promise<unknown> {
  if (mime === "application/pdf") throw new Error("DeepSeek cannot read PDFs yet — use a JPG/PNG photo, or Gemini/Claude");
  const res = await fetch((process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com") + "/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}` },
    body: JSON.stringify({
      model: process.env.DEEPSEEK_MODEL || "deepseek-v4-flash-vision-exp",
      messages: [{
        role: "user",
        content: [
          { type: "image_url", image_url: { url: `data:${mime};base64,${b64(file)}` } },
          { type: "text", text: `${prompt}\n\nChỉ trả về JSON đúng dạng:\n${shape}` },
        ],
      }],
      response_format: { type: "json_object" },
      temperature: 0,
    }),
  });
  if (!res.ok) throw new Error(`DeepSeek ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const j = (await res.json()) as any; // eslint-disable-line @typescript-eslint/no-explicit-any
  const text = j?.choices?.[0]?.message?.content;
  if (!text) throw new Error("DeepSeek returned no content");
  return parseJson(text);
}

/** Một số model bọc JSON trong ```json ... ``` — bóc ra trước khi parse. */
export function parseJson(text: string): unknown {
  const t = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return JSON.parse(t);
  } catch {
    const a = t.indexOf("{"), b = t.lastIndexOf("}");
    if (a >= 0 && b > a) return JSON.parse(t.slice(a, b + 1));
    throw new Error("The AI response was not JSON");
  }
}

const toInt = (v: unknown): number | null => {
  if (v == null || v === "") return null;
  const n = Number(String(v).replace(/[.,\s]/g, ""));
  return Number.isFinite(n) ? Math.round(n) : null;
};
/** Số tiền AI trả về (đơn vị chính, có thể có phần thập phân) → đơn vị nhỏ nhất của loại tiền. */
const toMinor = (v: unknown, digits: number): number | null => {
  if (v == null || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? Math.round(v * 10 ** digits) : null;
  const s = String(v).trim();
  return /\d/.test(s) ? parseAmount(s, digits) : null;
};
const toRate = (v: unknown): number | null => {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) && n > 0 && n <= 30 ? n : null;
};

/** Ép dữ liệu thô từ AI về đúng kiểu, bỏ dòng rỗng; model nào cũng qua bước này. */
export function normalizeDraft(raw: unknown, validParts: Set<number>, digits = 0): Draft {
  const r = (raw ?? {}) as Record<string, unknown>;
  const date = typeof r.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.date) ? r.date : null;
  const items: DraftItem[] = (Array.isArray(r.items) ? r.items : [])
    .map((x: Record<string, unknown>) => {
      const pid = toInt(x.part_type_id);
      const qty = Number(x.qty);
      const conf = Number(x.confidence);
      const ok = pid != null && validParts.has(pid);
      return {
        raw_name: String(x.raw_name ?? "").trim(),
        qty: Number.isFinite(qty) && qty > 0 ? qty : 1,
        amount: toMinor(x.amount, digits) ?? 0,
        kind: x.kind === "labor" ? "labor" : "part",
        part_type_id: ok ? pid : null,
        how: ok ? "ai" : null,
        confidence: Number.isFinite(conf) ? Math.max(0, Math.min(1, conf)) : null,
      } as DraftItem;
    })
    .filter((x) => x.raw_name);
  return {
    garage: String(r.garage ?? "").trim(), date, odo: toInt(r.odo), slip_total: toMinor(r.slip_total, digits),
    discount: Math.max(0, toMinor(r.discount, digits) ?? 0), vat: Math.max(0, toMinor(r.vat, digits) ?? 0), vat_rate: toRate(r.vat_rate),
    vat_included: r.vat_included === true, items,
  };
}

/** Lớp xử lý sau AI: bộ nhớ đã xác nhận → (giữ kết quả AI) → từ khóa tự động; rồi suy ra VAT nếu AI bỏ sót. */
export async function refineDraft(d: Draft, parts: { id: number; key: string | null; name: string }[], taxRates?: number[]): Promise<Draft> {
  const kwParts = parts.map((p) => ({ id: p.id, kw: keywordsFor(p.name) }));
  const generic = parts.find((p) => p.key === GENERIC_KEY)?.id;
  for (const it of d.items) {
    const alias = await get<{ part_type_id: number }>("SELECT part_type_id FROM part_aliases WHERE alias = ?", normName(it.raw_name));
    if (alias) { it.part_type_id = alias.part_type_id; it.how = "memory"; it.confidence = 1; continue; }
    const guess = guessPart(it.raw_name, kwParts);
    // AI trả "Khác"/không chắc mà từ khóa nhận ra rõ hơn → dùng từ khóa
    if (guess && (it.part_type_id == null || it.part_type_id === generic || (it.confidence ?? 1) < 0.5) && guess !== it.part_type_id) {
      it.part_type_id = guess; it.how = "keyword";
    } else if (it.part_type_id == null && guess) { it.part_type_id = guess; it.how = "keyword"; }
    if (it.part_type_id === generic) { it.how = it.how ?? "ai"; it.confidence = Math.min(it.confidence ?? 0.3, 0.3); }
  }
  const sum = d.items.reduce((a, b) => a + b.amount, 0);
  const iv = inferVat(sum, d.discount, d.vat, d.slip_total, taxRates);
  if (iv.inferred) { d.vat = iv.vat; d.vat_rate = iv.rate; d.vat_inferred = true; d.vat_included = false; }
  return d;
}

/** Đọc ảnh/PDF rồi trả JSON theo `shape` — dùng cho các tác vụ ngoài phiếu (VD: bảng chu kỳ trong sổ hướng dẫn). */
export async function visionJson(provider: Provider, file: Buffer, mime: string, prompt: string, shape: string): Promise<unknown> {
  if (provider === "gemini") return viaGemini(file, mime, prompt, shape);
  if (provider === "deepseek") return viaDeepseek(file, mime, prompt, shape);
  const res = await claudeCall({
    max_tokens: 16000, output_config: { effort: "low" },
    messages: [{ role: "user", content: [media(file, mime), { type: "text", text: `${prompt}\n\nChỉ trả về JSON đúng dạng:\n${shape}` }] }],
  });
  const text = claudeText(res);
  if (!text) throw new Error("Claude returned no content");
  return parseJson(text);
}

const RUN = { claude: viaClaude, gemini: viaGemini, deepseek: viaDeepseek } as const;

export async function extractSlip(file: Buffer, mime: string, ctx: AiCtx): Promise<Draft & { provider: Provider }> {
  const order = providerOrder();
  if (!order.length) throw new Error(ctx.t("ai.no_key"));
  const parts = await all<{ id: number; key: string | null; name: string; category: string }>("SELECT id, key, name, category FROM part_types ORDER BY id");
  const prompt = buildPrompt(parts, ctx);
  const errors: string[] = [];
  for (const provider of order) {
    try {
      const raw = await RUN[provider](file, mime, prompt);
      const d = normalizeDraft(raw, new Set(parts.map((p) => p.id)), ctx.digits);
      if (!d.items.length) throw new Error(ctx.t("ai.no_lines"));
      return { ...(await refineDraft(d, parts, ctx.taxRates)), provider };
    } catch (e) {
      errors.push(`${provider}: ${e instanceof Error ? e.message : e}`);
    }
  }
  throw new Error(errors.join(" | "));
}
