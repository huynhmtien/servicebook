import { test } from "node:test";
import assert from "node:assert/strict";
import en from "./i18n/en.ts";
import vi from "./i18n/vi.ts";
import { makeT, detectLang, detectRegion, LANGS } from "./i18n/index.ts";

const ph = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");

test("mọi ngôn ngữ có đủ khóa như tiếng Anh, không thừa", () => {
  for (const [code, { dict }] of Object.entries(LANGS)) {
    assert.deepEqual(Object.keys(dict).sort(), Object.keys(en).sort(), `ngôn ngữ ${code}`);
  }
});

test("biến {…} giữ nguyên giữa các ngôn ngữ", () => {
  for (const k of Object.keys(en) as (keyof typeof en)[]) {
    assert.equal(ph(vi[k]), ph(en[k]), `khóa ${k}`);
  }
});

test("không có chuỗi rỗng", () => {
  for (const [k, v] of Object.entries(en)) assert.ok(v.length > 0, k);
  for (const [k, v] of Object.entries(vi)) assert.ok(v.length > 0, k);
});

test("nội suy biến và số nhiều", () => {
  const t = makeT(LANGS.en.dict, "en-US");
  assert.equal(t("describe.days_left", { count: 1 }), "1 day left");
  assert.equal(t("describe.days_left", { count: 5 }), "5 days left");
  assert.equal(t("describe.km_left", { n: "1,200", unit: "mi" }), "1,200 mi left");
  const v = makeT(LANGS.vi.dict, "vi-VN");
  assert.equal(v("describe.days_left", { count: 1 }), "còn 1 ngày");
  assert.equal(v("describe.days_left", { count: 7 }), "còn 7 ngày");
});

test("biến thiếu giữ nguyên dấu {…} (không báo lỗi)", () => {
  const t = makeT(LANGS.en.dict, "en-US");
  assert.equal(t("describe.km_left", { unit: "km" }), "{n} km left");
});

test("nhận diện ngôn ngữ/vùng từ Accept-Language", () => {
  assert.equal(detectLang("vi-VN,vi;q=0.9,en;q=0.8"), "vi");
  assert.equal(detectLang("fr-FR,fr;q=0.9,en;q=0.8"), "en");
  assert.equal(detectLang("de-DE,en-US;q=0.5"), "en");
  assert.equal(detectLang(null), "en");
  assert.equal(detectRegion("en-GB,en;q=0.9"), "GB");
  assert.equal(detectRegion("vi"), null);
});
