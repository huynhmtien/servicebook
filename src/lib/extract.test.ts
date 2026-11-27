import { test } from "node:test";
import assert from "node:assert/strict";
import { parseJson, normalizeDraft } from "./extract.ts";

test("parseJson bóc ```json fence và text thừa", () => {
  assert.deepEqual(parseJson('```json\n{"a":1}\n```'), { a: 1 });
  assert.deepEqual(parseJson('Đây là kết quả: {"a":2} xong'), { a: 2 });
  assert.throws(() => parseJson("không có json"));
});

test("normalizeDraft ép kiểu, bỏ dòng rỗng, loại part_type_id lạ", () => {
  const d = normalizeDraft(
    {
      garage: " Toyota Q7 ", date: "2026-09-01", odo: "47.000", slip_total: "1.900.000",
      items: [
        { raw_name: "Nhớt", qty: "4", amount: "800.000", kind: "part", part_type_id: 2 },
        { raw_name: "Công", qty: 0, amount: 100000, kind: "labor", part_type_id: 999 },
        { raw_name: "  ", qty: 1, amount: 5 },
      ],
    },
    new Set([1, 2]),
  );
  assert.equal(d.garage, "Toyota Q7");
  assert.equal(d.odo, 47000);
  assert.equal(d.slip_total, 1900000);
  assert.equal(d.items.length, 2);
  assert.equal(d.items[0].qty, 4);
  assert.equal(d.items[0].amount, 800000);
  assert.equal(d.items[1].part_type_id, null);
  assert.equal(d.items[1].qty, 1);
});

test("date sai định dạng → null", () => {
  assert.equal(normalizeDraft({ date: "01/09/2026", items: [] }, new Set()).date, null);
});

test("VAT / giảm giá / tỷ lệ được ép kiểu và giới hạn hợp lý", () => {
  const d = normalizeDraft({ discount: "50.000", vat: "85.600", vat_rate: "8", vat_included: true, items: [] }, new Set());
  assert.equal(d.discount, 50000);
  assert.equal(d.vat, 85600);
  assert.equal(d.vat_rate, 8);
  assert.equal(d.vat_included, true);
  const bad = normalizeDraft({ discount: -5, vat_rate: 900, items: [] }, new Set());
  assert.equal(bad.discount, 0);
  assert.equal(bad.vat_rate, null);
  assert.equal(bad.vat_included, false);
});

test("độ tin cậy được kẹp trong 0..1", () => {
  const d = normalizeDraft({ items: [{ raw_name: "x", qty: 1, amount: 1, kind: "part", part_type_id: 1, confidence: 7 }] }, new Set([1]));
  assert.equal(d.items[0].confidence, 1);
  assert.equal(d.items[0].how, "ai");
});

test("normalizeDraft: số tiền thập phân → đơn vị nhỏ nhất (USD 2 chữ số)", () => {
  const d = normalizeDraft({ garage: "Joe's", date: "2026-03-04", odo: 41000, discount: 5, vat: "7.25", vat_rate: 7, vat_included: false, slip_total: 122.5,
    items: [{ raw_name: "Oil change", qty: 1, amount: 89.99, kind: "part", part_type_id: 2, confidence: 0.9 }] }, new Set([2]), 2);
  assert.equal(d.items[0].amount, 8999);
  assert.equal(d.discount, 500);
  assert.equal(d.vat, 725);
  assert.equal(d.slip_total, 12250);
  assert.equal(d.odo, 41000);
});

test("normalizeDraft: VND (0 chữ số) giữ nguyên số nguyên", () => {
  const d = normalizeDraft({ items: [{ raw_name: "Dầu", qty: 1, amount: 800000, kind: "part", part_type_id: 2, confidence: 1 }], slip_total: "1.263.600" }, new Set([2]), 0);
  assert.equal(d.items[0].amount, 800000);
  assert.equal(d.slip_total, 1263600);
});

import { normalizeNewPart, normalizeDraft as _nd } from "./extract.ts";
test("new_part proposals need a name and a known non-cost category", () => {
  assert.deepEqual(normalizeNewPart({ name: "  Mâm ly hợp ", category: "drivetrain" }), { name: "Mâm ly hợp", category: "drivetrain" });
  assert.equal(normalizeNewPart({ name: "x", category: "drivetrain" }), null);
  assert.equal(normalizeNewPart({ name: "Phí", category: "other_costs" }), null);
  assert.equal(normalizeNewPart({ name: "Thing", category: "nope" }), null);
  const d = _nd({ items: [{ raw_name: "LA BO AMAZA", qty: 1, amount: 2600000, kind: "part", part_type_id: null, confidence: 0.3, new_part: { name: "Bộ ly hợp", category: "drivetrain" } }] }, new Set([1]));
  assert.equal(d.items[0].new_part?.name, "Bộ ly hợp");
  const d2 = _nd({ items: [{ raw_name: "Dau", qty: 1, amount: 1, kind: "part", part_type_id: 1, confidence: 1, new_part: { name: "Bộ ly hợp", category: "drivetrain" } }] }, new Set([1]));
  assert.equal(d2.items[0].new_part, null);
});
