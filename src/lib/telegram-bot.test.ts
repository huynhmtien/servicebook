import { test } from "node:test";
import assert from "node:assert/strict";
import { parseOdoMessage } from "./odo-parse.ts";

const one = [{ id: 1, name: "Fortuner", plate: "51K-123.45", odo: 48000 }];
const two = [...one, { id: 2, name: "Work Truck", plate: "29A-999.99", odo: 90000 }];

test("một xe: chỉ cần số", () => {
  for (const [txt, km] of [["52000", 52000], ["52,000", 52000], ["52.000 km", 52000], ["  52 000 mi ", 52000]] as const) {
    const r = parseOdoMessage(txt, one);
    assert.equal(r.kind, "ok", txt);
    if (r.kind === "ok") { assert.equal(r.km, km); assert.equal(r.vehicle.id, 1); }
  }
});
test("nhiều xe: cần tên hoặc biển số, không phân biệt hoa thường/dấu", () => {
  const a = parseOdoMessage("truck 91000", two); assert.ok(a.kind === "ok" && a.vehicle.id === 2 && a.km === 91000);
  const b = parseOdoMessage("FORTUNER 52000", two); assert.ok(b.kind === "ok" && b.vehicle.id === 1);
  const c = parseOdoMessage("29a 91000", two); assert.ok(c.kind === "ok" && c.vehicle.id === 2);
  assert.equal(parseOdoMessage("52000", two).kind, "which");
  assert.equal(parseOdoMessage("zzz 52000", two).kind, "which");
});
test("tin không phải ODO → none", () => {
  for (const t of ["hello", "", "thanks!", "0", "-5", "99999999999"]) assert.equal(parseOdoMessage(t, one).kind, "none", t);
  assert.equal(parseOdoMessage("52000", []).kind, "none");
});
