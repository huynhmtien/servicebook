import { test } from "node:test";
import assert from "node:assert/strict";
import { expectedTotal, inferVat, netFactor, reconcile, vatFromRate } from "./money.ts";

test("VAT tách riêng được cộng vào tổng", () => {
  assert.equal(expectedTotal({ sum: 1000000, discount: 0, vat: 80000, vatIncluded: false }), 1080000);
});
test("VAT đã gồm trong giá thì không cộng thêm", () => {
  assert.equal(expectedTotal({ sum: 1080000, discount: 0, vat: 80000, vatIncluded: true }), 1080000);
});
test("giảm giá trừ trước khi cộng VAT", () => {
  assert.equal(expectedTotal({ sum: 1000000, discount: 100000, vat: 72000, vatIncluded: false }), 972000);
});
test("suy ra VAT 8% khi AI bỏ sót", () => {
  assert.deepEqual(inferVat(1070000, 0, 0, 1155600), { vat: 85600, rate: 8, inferred: true });
});
test("suy ra VAT 10% sau giảm giá", () => {
  assert.deepEqual(inferVat(1100000, 100000, 0, 1100000), { vat: 100000, rate: 10, inferred: true });
});
test("không suy ra khi chênh lệch lạ (có thể đọc sót dòng)", () => {
  assert.equal(inferVat(1120000, 0, 0, 1155600).inferred, false);
});
test("đã có VAT thì giữ nguyên; tổng khớp thì không có VAT", () => {
  assert.equal(inferVat(1000000, 0, 80000, 1080000).inferred, false);
  assert.deepEqual(inferVat(1000000, 0, 0, 1000000), { vat: 0, rate: null, inferred: false });
});
test("reconcile: khớp / lệch", () => {
  const m = { sum: 1070000, discount: 0, vat: 85600, vatIncluded: false };
  assert.equal(reconcile(m, 1155600).ok, true);
  assert.equal(reconcile(m, 1209600).diff, 54000);
  assert.equal(reconcile(m, null).ok, null);
});
test("giá trước thuế để so sánh giữa garage", () => {
  assert.equal(Math.round(1080000 * netFactor(8, true)), 1000000);
  assert.equal(netFactor(8, false), 1);
  assert.equal(netFactor(null, true), 1);
  assert.equal(vatFromRate(1070000, 8), 85600);
});

test("inferVat: thuế suất theo danh sách tùy chọn (en: 7%, 20%)", async () => {
  const { inferVat } = await import("./money.ts");
  assert.deepEqual(inferVat(10000, 0, 0, 10700, [5, 7, 10]), { vat: 700, rate: 7, inferred: true });
  assert.equal(inferVat(10000, 0, 0, 10700).inferred, false); // mặc định (5/8/10) không có 7%
  assert.deepEqual(inferVat(10000, 0, 0, 12000, [5, 7, 20]), { vat: 2000, rate: 20, inferred: true });
});
