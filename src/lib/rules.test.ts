import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateRule, avgKmPerDay } from "./rules.ts";
import { addMonths } from "./util.ts";

const base = { vehicleOdo: 20000, today: "2026-10-08", avgKmPerDay: 50 };

test("unknown khi chưa có lần thay", () => {
  const r = evaluateRule({ ...base, intervalKm: 5000, intervalMonths: 6, last: null });
  assert.equal(r.status, "unknown");
});

test("ok khi còn xa", () => {
  const r = evaluateRule({ ...base, intervalKm: 10000, intervalMonths: 12, last: { date: "2026-09-01", odo: 19000 } });
  assert.equal(r.status, "ok");
  assert.equal(r.kmLeft, 9000);
});

test("soon theo km", () => {
  const r = evaluateRule({ ...base, intervalKm: 5000, intervalMonths: 12, last: { date: "2026-08-01", odo: 15400 } });
  assert.equal(r.kmLeft, 400);
  assert.equal(r.status, "soon");
  assert.equal(r.trigger, "km");
});

test("overdue theo thời gian dù km còn nhiều", () => {
  const r = evaluateRule({ ...base, intervalKm: 40000, intervalMonths: 6, last: { date: "2026-03-01", odo: 18000 } });
  assert.equal(r.status, "overdue");
  assert.equal(r.trigger, "time");
});

test("overdue theo km", () => {
  const r = evaluateRule({ ...base, intervalKm: 5000, intervalMonths: 12, last: { date: "2026-07-01", odo: 14000 } });
  assert.equal(r.status, "overdue");
  assert.equal(r.trigger, "km");
});

test("chỉ có chu kỳ thời gian (ắc quy, đăng kiểm)", () => {
  const r = evaluateRule({ ...base, intervalKm: null, intervalMonths: 24, last: { date: "2025-10-20", odo: null } });
  assert.equal(r.dueDate, "2027-10-20");
  assert.equal(r.status, "ok");
});

test("addMonths xử lý cuối tháng", () => {
  assert.equal(addMonths("2026-08-31", 6), "2027-02-28");
});

test("avgKmPerDay", () => {
  const v = avgKmPerDay([{ date: "2026-01-01", km: 10000 }, { date: "2026-04-11", km: 15000 }], "2026-10-08");
  assert.equal(Math.round(v), 50);
  assert.equal(avgKmPerDay([], "2026-10-08"), 40);
});
