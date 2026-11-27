import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeVehicleScan, normalizeDefect } from "./vehicle-ai.ts";

test("registration scan is cleaned: plate upper-cased, bad enums/years dropped", () => {
  const v = normalizeVehicleScan({ plate: "65a-168.56", make: "Toyota", model: "Fortuner", year: "2015", fuel: "Diesel", transmission: "n/a", engine: "2.5L", vin: "mr0 abc 123", junk: 1 });
  assert.deepEqual(v, { plate: "65A-168.56", make: "Toyota", model: "Fortuner", year: 2015, fuel: "diesel", transmission: null, engine: "2.5L", vin: "MR0ABC123" });
  assert.equal(normalizeVehicleScan({ year: 1800, fuel: "steam" }).year, null);
  assert.equal(normalizeVehicleScan(null).plate, null);
});
test("defect scan needs a title; severity defaults to medium", () => {
  assert.equal(normalizeDefect({ description: "x" }), null);
  assert.equal(normalizeDefect({ title: "Rách lốp", severity: "weird" })!.severity, "medium");
  assert.equal(normalizeDefect({ title: "Rò dầu", severity: "high", area: "gầm" })!.severity, "high");
});
