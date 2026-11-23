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
