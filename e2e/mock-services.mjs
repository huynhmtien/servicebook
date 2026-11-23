// Fake Telegram + Gemini for E2E testing without real keys.
// Switch Telegram mode: GET /__mode/ok | badtoken | nochat ; view the log: GET /__log
import http from "node:http";
let mode = "ok";
const log = [];
const bodies = []; // request bodies (to check message/webhook content)
// Default record: the AI misreads 1 extra row and misses VAT; the AI can't classify "Lọc gió cabin" (keywords will recognize it)
const BASE = { garage: "Toyota Tân Cảng", date: "2026-09-20", odo: 49500, discount: 0, vat: 0, vat_rate: null, vat_included: false };
const GOOD = [
  { raw_name: "Dầu động cơ 0W20 (4L)", qty: 4, amount: 800000, kind: "part", part_type_id: 2, confidence: 0.95 },
  { raw_name: "Lọc dầu động cơ", qty: 1, amount: 120000, kind: "part", part_type_id: 3, confidence: 0.9 },
  { raw_name: "Công thay dầu", qty: 1, amount: 150000, kind: "labor", part_type_id: 2, confidence: 0.8 },
  { raw_name: "Lọc gió cabin", qty: 1, amount: 100000, kind: "part", part_type_id: null, confidence: 0.2 },
];
const DRAFTS = {
  junk: { ...BASE, slip_total: 1263600, items: [...GOOD, { raw_name: "Dòng đọc nhầm", qty: 1, amount: 50000, kind: "part", part_type_id: null, confidence: 0.1 }] },
  vat: { ...BASE, slip_total: 1263600, items: GOOD },
};
let draft = "junk";
const INTERVALS = {
  vehicle_desc: "Toyota Fortuner 2022 (máy dầu 2.4L)", caveats: "Điều kiện khắc nghiệt (kẹt xe, bụi) nên rút ngắn một nửa.",
  items: [
    { part_type_id: 2, interval_km: 10000, interval_months: 12, note: "Bình thường 10.000 km; khắc nghiệt 5.000 km", source_url: "https://example.com/toyota-fortuner-lich-bao-duong", confidence: "high" },
    { part_type_id: 9, interval_km: 20000, interval_months: 12, note: "Theo đại lý", source_url: "https://example.com/dai-ly", confidence: "medium" },
    { part_type_id: 6, interval_km: 100000, interval_months: null, note: "Suy ra từ xe tương tự", source_url: null, confidence: "low" },
  ],
};
http.createServer((req, res) => {
  let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => {
    const j = (code, o) => { res.writeHead(code, { "content-type": "application/json" }); res.end(JSON.stringify(o)); };
    const url = req.url.replace(/bot[^/]+/, "bot***");
    if (url.startsWith("/__mode/")) { mode = url.split("/")[2]; return j(200, { mode }); }
    if (url.startsWith("/__draft/")) { draft = url.split("/")[2]; return j(200, { draft }); }
    if (url === "/__log") return j(200, log);
    if (url === "/__bodies") return j(200, bodies);
    log.push(`${req.method} ${url}`);
    bodies.push({ url, body: b });
    if (url.includes(":generateContent")) {
      if (b.includes("google_search")) // web lookup: includes sources (grounding)
        return j(200, { candidates: [{ content: { parts: [{ text: "```json\n" + JSON.stringify(INTERVALS) + "\n```" }] },
          groundingMetadata: { groundingChunks: [{ web: { uri: "https://example.com/toyota-fortuner-lich-bao-duong", title: "Lịch bảo dưỡng Fortuner" } }] } }] });
      if (b.includes("MAINTENANCE INTERVAL TABLE")) return j(200, { candidates: [{ content: { parts: [{ text: JSON.stringify({ ...INTERVALS, items: INTERVALS.items.slice(0, 2).map((x) => ({ ...x, source_url: null, confidence: "high" })) }) }] } }] });
      return j(200, { candidates: [{ content: { parts: [{ text: JSON.stringify(DRAFTS[draft]) }] } }] });
    }
    if (url.includes("/setWebhook")) return j(200, { ok: true, result: true });
    if (url.includes("/getMe")) return mode === "badtoken" ? j(404, { ok: false, error_code: 404, description: "Not Found" }) : j(200, { ok: true, result: { username: "servicebook_bot" } });
    if (url.includes("/sendMessage")) {
      if (mode === "nochat") return j(400, { ok: false, error_code: 400, description: "Bad Request: chat not found" });
      return j(200, { ok: true, result: {} });
    }
    j(404, { ok: false });
  });
}).listen(Number(process.env.MOCK_PORT || 5599));
