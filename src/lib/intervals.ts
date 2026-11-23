import { all } from "./db.ts";
import { COST_ONLY } from "./parts.ts";
import { claudeCall, claudeText, geminiCall, parseJson, providerOrder, visionJson, type Provider } from "./extract.ts";

export interface IntervalItem {
  part_type_id: number; interval_km: number | null; interval_months: number | null;
  note: string; source_url: string | null; confidence: "high" | "medium" | "low";
}
export interface IntervalProposal {
  kind: "intervals"; vehicle_id: number; origin: "ai" | "doc"; provider: Provider | string;
  vehicle_desc: string; sources: { title: string; url: string }[]; caveats: string; items: IntervalItem[];
}

const SHAPE = `{
  "vehicle_desc": string (xe/động cơ/đời xe mà các số liệu áp dụng),
  "caveats": string (lưu ý: điều kiện vận hành, khác biệt theo động cơ, chỗ chưa chắc),
  "items": [ { "part_type_id": integer, "interval_km": integer|null (km giữa 2 lần thay), "interval_months": integer|null (tháng giữa 2 lần thay),
               "note": string (VD: điều kiện bình thường 10.000 km; khắc nghiệt 5.000 km), "source_url": string|null,
               "confidence": "high"|"medium"|"low" } ]
}`;

/** AI có khả năng tìm web: Claude (web_search) hoặc Gemini (Google Search grounding). DeepSeek thì không. */
export const researchProviders = (): Provider[] => providerOrder().filter((p) => p === "claude" || p === "gemini");

export async function trackedParts() {
  return all<{ id: number; name: string }>("SELECT id, name FROM part_types WHERE category <> ? ORDER BY id", COST_ONLY);
}

const intOrNull = (v: unknown, max: number): number | null => {
  const n = Number(String(v ?? "").replace(/[.,\s]/g, ""));
  return Number.isFinite(n) && n > 0 && n <= max ? Math.round(n) : null;
};

/** Ép kết quả AI về kiểu chuẩn; bỏ dòng lạ hoặc không có số nào. */
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

function researchPrompt(desc: string, parts: { id: number; name: string }[]): string {
  return (
    `BẢNG CHU KỲ bảo dưỡng — hãy tìm trên web lịch bảo dưỡng CHÍNH THỨC của nhà sản xuất cho xe: ${desc}.\n` +
    `Ưu tiên theo thứ tự: sổ hướng dẫn sử dụng / sổ bảo hành bảo dưỡng của hãng (đúng đời xe, đúng thị trường Việt Nam nếu có), ` +
    `trang chính thức của hãng hoặc đại lý chính hãng tại Việt Nam, rồi mới đến nguồn uy tín khác.\n\n` +
    `Danh sách linh kiện cần điền (id: tên):\n${parts.map((p) => `${p.id}: ${p.name}`).join("\n")}\n\n` +
    `Quy tắc: CHỈ điền linh kiện mà nguồn nói rõ chu kỳ; không có nguồn thì BỎ QUA, tuyệt đối không đoán. ` +
    `"confidence" = "high" chỉ khi trích từ tài liệu chính thức của hãng cho đúng xe này; "medium" khi từ đại lý/nguồn uy tín; "low" khi suy ra hoặc áp dụng cho xe tương tự. ` +
    `Nếu hãng nêu cả điều kiện bình thường và khắc nghiệt (kẹt xe, bụi, đường xấu, chạy ngắn) thì dùng mức bình thường cho số chính và ghi mức khắc nghiệt vào "note". ` +
    `Mỗi mục kèm "source_url" của trang đã dùng. Nếu xe có nhiều loại động cơ/hộp số mà anh không biết loại nào, nêu trong "caveats".`
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
    if (res.stop_reason !== "pause_turn") break; // pause_turn: tìm web chưa xong, gửi lại để tiếp tục
    messages.push({ role: "assistant", content: res.content });
  }
  if (!text) throw new Error("Claude không trả về kết quả tra cứu");
  return { text, sources: [...sources].map(([url, title]) => ({ title, url })) };
}

async function searchGemini(prompt: string): Promise<{ text: string; sources: { title: string; url: string }[] }> {
  return geminiCall({
    contents: [{ parts: [{ text: `${prompt}\n\nSau khi tra cứu, chỉ trả về JSON đúng dạng (không thêm lời giải thích):\n${SHAPE}` }] }],
    tools: [{ google_search: {} }],
    generationConfig: { temperature: 0 },
  });
}

/** Tra cứu chu kỳ chuẩn theo dòng xe. Kết quả chỉ là ĐỀ XUẤT — người dùng phải xác nhận. */
export async function researchIntervals(vehicle: { id: number; name: string; model: string | null; year: number | null }): Promise<IntervalProposal> {
  const providers = researchProviders();
  if (!providers.length) throw new Error("Tính năng tra cứu cần GEMINI_API_KEY hoặc ANTHROPIC_API_KEY (DeepSeek không tìm được web). Hoặc dùng cách quét bảng trong sổ hướng dẫn.");
  const desc = [vehicle.model || vehicle.name, vehicle.year ? `đời ${vehicle.year}` : ""].filter(Boolean).join(" ");
  const parts = await trackedParts();
  const prompt = researchPrompt(desc, parts);
  const errors: string[] = [];
  for (const provider of providers) {
    try {
      const { text, sources } = await (provider === "claude" ? searchClaude : searchGemini)(prompt);
      const p = normalizeProposal(parseJson(text), new Set(parts.map((x) => x.id)), { vehicle_id: vehicle.id, origin: "ai", provider, sources });
      if (!p.items.length) throw new Error("không tìm được chu kỳ có nguồn rõ ràng cho xe này");
      return p;
    } catch (e) {
      errors.push(`${provider}: ${e instanceof Error ? e.message : e}`);
    }
  }
  throw new Error(errors.join(" | "));
}

/** Đọc bảng bảo dưỡng chụp từ sổ hướng dẫn / sổ bảo hành của xe. */
export async function extractIntervalsFromDoc(vehicle: { id: number }, file: Buffer, mime: string): Promise<IntervalProposal> {
  const order = providerOrder();
  if (!order.length) throw new Error("Chưa cấu hình khóa AI trong .env");
  const parts = await trackedParts();
  const prompt =
    `Đây là ảnh/PDF trang BẢNG CHU KỲ bảo dưỡng trong sổ hướng dẫn / sổ bảo hành của một chiếc ô tô. ` +
    `Hãy đọc bảng và quy đổi thành chu kỳ cho từng linh kiện (km giữa 2 lần thay/kiểm tra và/hoặc số tháng). ` +
    `Nếu bảng đánh dấu theo các mốc (10.000, 20.000, ... km) thì chu kỳ là khoảng cách giữa các mốc có dấu. ` +
    `Chỉ điền linh kiện có trong bảng; không đoán. "confidence" = "high" khi đọc rõ, "low" khi chữ mờ/không chắc. "source_url" = null.\n\n` +
    `Danh sách linh kiện (id: tên):\n${parts.map((p) => `${p.id}: ${p.name}`).join("\n")}`;
  const errors: string[] = [];
  for (const provider of order) {
    try {
      const raw = await visionJson(provider, file, mime, prompt, SHAPE);
      const p = normalizeProposal(raw, new Set(parts.map((x) => x.id)), { vehicle_id: vehicle.id, origin: "doc", provider, sources: [] });
      if (!p.items.length) throw new Error("không đọc được chu kỳ nào từ trang này");
      return p;
    } catch (e) {
      errors.push(`${provider}: ${e instanceof Error ? e.message : e}`);
    }
  }
  throw new Error(errors.join(" | "));
}
