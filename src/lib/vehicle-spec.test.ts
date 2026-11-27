import { test } from "node:test";
import assert from "node:assert/strict";
import { fullModel, specDesc, oneOf, FUELS } from "./vehicle-spec.ts";

const v = { name: "Fortuner", model: "Toyota", year: 2015, fuel: "diesel", transmission: "manual", engine: "2.5L 2KD" };
test("fullModel merges make + model without duplicating", () => {
  assert.equal(fullModel(v), "Toyota Fortuner");
  assert.equal(fullModel({ name: "Fortuner", model: "Toyota Fortuner" }), "Toyota Fortuner");
  assert.equal(fullModel({ name: "Xe nhà", model: null }), "Xe nhà");
});
test("specDesc includes year, fuel, gearbox and engine", () => {
  assert.equal(specDesc(v), "Toyota Fortuner (2015), diesel, manual gearbox, 2.5L 2KD");
  assert.equal(specDesc({ ...v, fuel: null, transmission: null, engine: null, year: null }), "Toyota Fortuner");
});
test("oneOf only accepts known values", () => {
  assert.equal(oneOf(FUELS, "Diesel"), "diesel");
  assert.equal(oneOf(FUELS, "kerosene"), null);
});
