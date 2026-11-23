import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_PARTS, guessPart, keywordsFor, partLabel } from "./parts.ts";
import { normName } from "./util.ts";

const parts = DEFAULT_PARTS.map((p, i) => ({ id: i + 1, key: p.key, kw: keywordsFor(p.names.en) }));
const idOf = (key: string) => parts.find((p) => p.key === key)!.id;
const g = (s: string) => guessPart(s, parts);

test("nhận dạng tên hạng mục tiếng Việt thường gặp", () => {
  assert.equal(g("Dầu động cơ 0W-20 (4L)"), idOf("engine_oil"));
  assert.equal(g("NHỚT CASTROL 5W30"), idOf("engine_oil"));
  assert.equal(g("Lọc dầu động cơ"), idOf("oil_filter"));
  assert.equal(g("Lọc gió điều hòa"), idOf("cabin_filter"));
  assert.equal(g("Lọc gió động cơ"), idOf("air_filter"));
  assert.equal(g("Bố thắng trước"), idOf("brake_pads_front"));
  assert.equal(g("Đảo lốp, cân bằng động"), idOf("tire_rotation"));
  assert.equal(g("Thay lốp Michelin"), idOf("tires"));
  assert.equal(g("Nạp gas lạnh R134a"), idOf("ac_gas"));
  assert.equal(g("Rửa xe"), idOf("car_wash"));
  assert.equal(g("Công kiểm tra tổng quát"), idOf("labor"));
});

test("nhận dạng tên hạng mục tiếng Anh thường gặp", () => {
  assert.equal(g("Engine oil 0W-20 (4 qt)"), idOf("engine_oil"));
  assert.equal(g("Oil filter"), idOf("oil_filter"));
  assert.equal(g("Cabin air filter"), idOf("cabin_filter"));
  assert.equal(g("Engine air filter"), idOf("air_filter"));
  assert.equal(g("Front brake pads"), idOf("brake_pads_front"));
  assert.equal(g("Rear brake pads"), idOf("brake_pads_rear"));
  assert.equal(g("Tire rotation & balance"), idOf("tire_rotation"));
  assert.equal(g("Wheel alignment"), idOf("alignment"));
  assert.equal(g("Spark plugs x4"), idOf("spark_plugs"));
  assert.equal(g("Shop supplies"), idOf("misc"));
  assert.equal(g("Labor charge"), idOf("labor"));
  assert.equal(g("Transmission fluid"), idOf("atf"));
});

test("từ khóa dài hơn thắng (lọc gió điều hòa ≠ lọc gió động cơ)", () => {
  assert.equal(g("Lọc gió cabin"), idOf("cabin_filter"));
  assert.equal(g("Dầu hộp số CVT"), idOf("atf"));
  assert.equal(g("Dầu vi sai cầu sau"), idOf("gear_oil"));
  assert.equal(g("Cabin air filter"), idOf("cabin_filter"));
});

test("không đoán bừa khi không biết", () => {
  assert.equal(g("Zzz không rõ"), null);
  assert.equal(g("Qwerty unknown"), null);
});

test("từ khóa đã chuẩn hóa không dấu", () => {
  for (const p of parts) for (const k of p.kw) assert.equal(k, normName(k), `${p.key}: ${k}`);
});

test("partLabel: tên theo ngôn ngữ, linh kiện lạ giữ tên đã lưu", () => {
  assert.equal(partLabel({ key: "engine_oil", name: "Engine oil" }, "vi"), "Dầu động cơ");
  assert.equal(partLabel({ key: "engine_oil", name: "Engine oil" }, "en"), "Engine oil");
  assert.equal(partLabel({ key: null, name: "Custom thing" }, "vi"), "Custom thing");
  assert.equal(partLabel({ key: "engine_oil", name: "x" }, "xx"), "x");
});
