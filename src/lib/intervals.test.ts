import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeProposal } from "./intervals.ts";

const meta = { vehicle_id: 1, origin: "ai" as const, provider: "gemini", sources: [] };

test("ép kiểu, bỏ linh kiện lạ / trùng / không có số, chuẩn hóa độ tin cậy", () => {
  const p = normalizeProposal({
    vehicle_desc: "Fortuner 2022", caveats: "diesel",
    items: [
      { part_type_id: 2, interval_km: "10.000", interval_months: 12, note: "bình thường", source_url: "https://toyota.com.vn/x", confidence: "HIGH" },
      { part_type_id: 2, interval_km: 5000 },
      { part_type_id: 99, interval_km: 5000 },
      { part_type_id: 3, interval_km: null, interval_months: null },
      { part_type_id: 4, interval_km: 9999999, interval_months: 999 },
      { part_type_id: 5, interval_km: 40000, source_url: "javascript:alert(1)", confidence: "???" },
    ],
  }, new Set([2, 3, 4, 5]), meta);
  assert.equal(p.items.length, 2);
  assert.deepEqual(p.items[0], { part_type_id: 2, interval_km: 10000, interval_months: 12, note: "bình thường", source_url: "https://toyota.com.vn/x", confidence: "high" });
  assert.equal(p.items[1].source_url, null); // URL không phải http(s) bị loại
  assert.equal(p.items[1].confidence, "medium");
});

test("dữ liệu rỗng không làm hỏng", () => {
  assert.equal(normalizeProposal(null, new Set([1]), meta).items.length, 0);
});
