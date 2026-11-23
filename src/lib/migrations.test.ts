import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { DEFAULT_PARTS } from "./parts.ts";

const dir = new URL("../../migrations/", import.meta.url);
const sql = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort().map((f) => readFileSync(new URL(f, dir), "utf8")).join("\n");

test("migrations đánh số liên tục", () => {
  const nums = readdirSync(dir).filter((f) => f.endsWith(".sql")).map((f) => Number(f.slice(0, 4))).sort((a, b) => a - b);
  nums.forEach((n, i) => assert.equal(n, i + 1));
});
test("mọi linh kiện trong parts.ts đều có trong migrations (nếu thiếu: npm run gen:seed hoặc viết migration mới)", () => {
  for (const p of DEFAULT_PARTS) assert.ok(sql.includes(`'${p.name.replace(/'/g, "''")}'`), `thiếu trong migrations: ${p.name}`);
});
