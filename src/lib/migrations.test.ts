import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { DEFAULT_PARTS, CATEGORIES } from "./parts.ts";

const dir = new URL("../../migrations/", import.meta.url);
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
const sql = files.map((f) => readFileSync(new URL(f, dir), "utf8")).join("\n");

test("migrations đánh số liên tục", () => {
  files.map((f) => Number(f.slice(0, 4))).forEach((n, i) => assert.equal(n, i + 1));
});
test("mọi linh kiện trong parts.ts có trong migrations (khóa + tên tiếng Anh) — thiếu thì viết migration mới", () => {
  for (const p of DEFAULT_PARTS) {
    assert.ok(sql.includes(`'${p.key}'`), `thiếu khóa trong migrations: ${p.key}`);
    assert.ok(sql.includes(`'${p.names.en.replace(/'/g, "''")}'`), `thiếu tên EN trong migrations: ${p.names.en}`);
  }
});
test("khóa linh kiện duy nhất và nhóm hợp lệ", () => {
  assert.equal(new Set(DEFAULT_PARTS.map((p) => p.key)).size, DEFAULT_PARTS.length);
  for (const p of DEFAULT_PARTS) assert.ok((CATEGORIES as readonly string[]).includes(p.category), p.key);
});
test("mọi nhóm đều có trong migration chuyển nhóm", () => {
  for (const c of CATEGORIES) assert.ok(sql.includes(`'${c}'`), `thiếu nhóm ${c}`);
});
