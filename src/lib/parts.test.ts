import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_PARTS, guessPart, keywordsFor } from "./parts.ts";
import { normName } from "./util.ts";

const parts = DEFAULT_PARTS.map((p, i) => ({ id: i + 1, name: p.name, kw: keywordsFor(p.name) }));
const idOf = (n: string) => parts.find((p) => p.name === n)!.id;
const g = (s: string) => guessPart(s, parts);

test("nhận dạng tên hạng mục thường gặp trên phiếu hãng", () => {
  assert.equal(g("Dầu động cơ 0W-20 (4L)"), idOf("Dầu động cơ"));
  assert.equal(g("NHỚT CASTROL 5W30"), idOf("Dầu động cơ"));
  assert.equal(g("Lọc dầu động cơ"), idOf("Lọc dầu động cơ"));
  assert.equal(g("Lọc gió điều hòa"), idOf("Lọc gió điều hòa"));
  assert.equal(g("Lọc gió động cơ"), idOf("Lọc gió động cơ"));
  assert.equal(g("Bố thắng trước"), idOf("Má phanh trước"));
  assert.equal(g("Đảo lốp, cân bằng động"), idOf("Đảo lốp"));
  assert.equal(g("Thay lốp Michelin"), idOf("Lốp xe"));
  assert.equal(g("Nạp gas lạnh R134a"), idOf("Gas điều hòa"));
  assert.equal(g("Rửa xe"), idOf("Rửa xe / vệ sinh xe"));
  assert.equal(g("Công kiểm tra tổng quát"), idOf("Nhân công / công thợ chung"));
});

test("từ khóa dài hơn thắng (lọc gió điều hòa ≠ lọc gió động cơ)", () => {
  assert.equal(g("Lọc gió cabin"), idOf("Lọc gió điều hòa"));
  assert.equal(g("Dầu hộp số CVT"), idOf("Dầu hộp số tự động"));
  assert.equal(g("Dầu vi sai cầu sau"), idOf("Dầu hộp số sàn / vi sai"));
});

test("không đoán bừa khi không biết", () => {
  assert.equal(g("Zzz không rõ"), null);
});

test("từ khóa đã chuẩn hóa không dấu", () => {
  for (const p of parts) for (const k of p.kw) assert.equal(k, normName(k), `${p.name}: ${k}`);
});
