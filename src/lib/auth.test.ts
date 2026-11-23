import { test } from "node:test";
import assert from "node:assert/strict";
import { makeSession, verifySession, passwordMatches, safeEqual, safeNext } from "./auth.ts";

const S = "khoa-bi-mat-thu-nghiem";
test("phiên hợp lệ được chấp nhận", async () => assert.equal(await verifySession(await makeSession(S), S), true));
test("sai khóa ký bị từ chối", async () => assert.equal(await verifySession(await makeSession(S), "khoa-khac"), false));
test("phiên hết hạn bị từ chối", async () => {
  const old = await makeSession(S, Date.now() - 31 * 86400_000);
  assert.equal(await verifySession(old, S), false);
});
test("sửa hạn trong cookie bị từ chối (chữ ký không khớp)", async () => {
  const [, sig] = (await makeSession(S)).split(".");
  assert.equal(await verifySession(`${Math.floor(Date.now() / 1000) + 99999999}.${sig}`, S), false);
});
test("cookie rỗng/rác bị từ chối", async () => {
  for (const t of [undefined, "", "abc", "1.2.3", "x.y"]) assert.equal(await verifySession(t, S), false);
});
test("so khớp mật khẩu", async () => {
  assert.equal(await passwordMatches("abc", "abc"), true);
  assert.equal(await passwordMatches("abc", "abd"), false);
  assert.equal(await passwordMatches("", "abc"), false);
});
test("safeEqual khác độ dài", () => { assert.equal(safeEqual("a", "ab"), false); assert.equal(safeEqual("ab", "ab"), true); });
test("safeNext chặn open redirect", () => {
  assert.equal(safeNext("//evil.com"), "/");
  assert.equal(safeNext("https://evil.com"), "/");
  assert.equal(safeNext("/vehicles/1"), "/vehicles/1");
});
