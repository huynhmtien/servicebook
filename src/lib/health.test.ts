import { test } from "node:test";
import assert from "node:assert/strict";
import { computeHealth, usedFraction, type HealthRule } from "./health.ts";

const r = (o: Partial<HealthRule>): HealthRule => ({ enabled: true, status: "ok", intervalKm: 10000, intervalMonths: 12, kmLeft: 5000, daysLeft: 180, ...o });

test("all on track = 100", () => {
  const h = computeHealth([r({}), r({})]);
  assert.equal(h.score, 100); assert.equal(h.level, "good");
});
test("overdue and due-soon lower the score; disabled rules are ignored", () => {
  const h = computeHealth([r({ status: "overdue" }), r({ status: "soon" }), r({ status: "overdue", enabled: false })]);
  assert.equal(h.score, 100 - 12 - 4); assert.equal(h.overdue, 1); assert.equal(h.soon, 1);
});
test("open defects cost by severity and the score never goes below 0", () => {
  assert.equal(computeHealth([], ["high", "low"]).score, 100 - 15 - 3);
  const h = computeHealth(Array.from({ length: 20 }, () => r({ status: "overdue" })), ["high", "high", "high"]);
  assert.equal(h.score, 100 - 60 - 30); assert.equal(h.level, "bad");
});
test("unknown items are not penalised", () => {
  const h = computeHealth([r({ status: "unknown" })]);
  assert.equal(h.score, 100); assert.equal(h.unknown, 1);
});
test("usedFraction takes the larger of km and time", () => {
  assert.equal(usedFraction(r({ kmLeft: 2500, daysLeft: 300 })), 0.75);
  assert.ok(Math.abs(usedFraction(r({ kmLeft: 9000, daysLeft: 91.2 }))! - 0.75) < 0.01);
  assert.equal(usedFraction(r({ kmLeft: null, daysLeft: null })), null);
  assert.equal(usedFraction(r({ kmLeft: -500, daysLeft: null }))! > 1, true);
});
