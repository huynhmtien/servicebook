import { test } from "node:test";
import assert from "node:assert/strict";
import { currencyDigits, makeFmt, parseAmount } from "./format.ts";

const norm = (s: string) => s.replace(/\s/g, " ");

test("số chữ số thập phân theo loại tiền", () => {
  assert.equal(currencyDigits("VND"), 0);
  assert.equal(currencyDigits("JPY"), 0);
  assert.equal(currencyDigits("USD"), 2);
  assert.equal(currencyDigits("EUR"), 2);
  assert.equal(currencyDigits("KWD"), 3);
});

test("đọc số tiền: VND (không thập phân) bỏ mọi dấu phân cách", () => {
  assert.equal(parseAmount("1.263.600", 0), 1263600);
  assert.equal(parseAmount("1,263,600", 0), 1263600);
  assert.equal(parseAmount("800 000", 0), 800000);
  assert.equal(parseAmount("", 0), 0);
  assert.equal(parseAmount("abc", 0), 0);
});

test("đọc số tiền: USD (2 chữ số thập phân) nhận diện dấu thập phân", () => {
  assert.equal(parseAmount("12.50", 2), 1250);
  assert.equal(parseAmount("12,50", 2), 1250);
  assert.equal(parseAmount("1,234.56", 2), 123456);
  assert.equal(parseAmount("1.234,56", 2), 123456);
  assert.equal(parseAmount("1,234", 2), 123400); // 3 chữ số sau dấu → là nghìn
  assert.equal(parseAmount("12", 2), 1200);
  assert.equal(parseAmount("0.5", 2), 50);
  assert.equal(parseAmount("-3.20", 2), -320);
});

test("định dạng tiền theo ngôn ngữ", () => {
  const vn = makeFmt({ locale: "vi-VN", currency: "VND", distance: "km", taxLabel: "VAT" });
  assert.equal(norm(vn.money(1263600)), "1.263.600 ₫");
  const us = makeFmt({ locale: "en-US", currency: "USD", distance: "mi", taxLabel: "Tax" });
  assert.equal(us.money(123456), "$1,234.56");
  assert.equal(us.money(5), "$0.05");
  assert.equal(us.dist(48500), "48,500 mi");
});

test("ngày theo ngôn ngữ, không lệch múi giờ", () => {
  const vn = makeFmt({ locale: "vi-VN", currency: "VND", distance: "km", taxLabel: "VAT" });
  const us = makeFmt({ locale: "en-US", currency: "USD", distance: "km", taxLabel: "Tax" });
  assert.equal(vn.date("2026-11-22"), "22/11/2026");
  assert.equal(us.date("2026-11-22"), "11/22/2026");
  assert.equal(us.date(null), "—");
});

test("giá trị điền sẵn vào ô nhập tiền rồi đọc lại đúng", () => {
  const us = makeFmt({ locale: "en-US", currency: "USD", distance: "km", taxLabel: "Tax" });
  for (const minor of [0, 5, 100, 123456, 99999999]) assert.equal(us.parse(us.amountInput(minor)), minor, String(minor));
  const vn = makeFmt({ locale: "vi-VN", currency: "VND", distance: "km", taxLabel: "VAT" });
  for (const minor of [0, 800000, 1263600]) assert.equal(vn.parse(vn.amountInput(minor)), minor, String(minor));
});
