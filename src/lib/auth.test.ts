import { test } from "node:test";
import assert from "node:assert/strict";
import { makeSession, verifySession, passwordMatches, safeEqual, safeNext } from "./auth.ts";

const S = "khoa-bi-mat-thu-nghiem";
test("phiên hợp lệ được chấp nhận", async () => assert.equal(await verifySession(await makeSession(S), S), true));
test("sai khóa ký bị từ chối", async () => assert.equal(await verifySession(await makeSession(S), "khoa-khac"), false));
test("phiên hết hạn bị từ chối", async () => {
  const old = await makeSession(S, 0, Date.now() - 31 * 86400_000);
  assert.equal(await verifySession(old, S), false);
});
test("sửa hạn trong cookie bị từ chối (chữ ký không khớp)", async () => {
  const [, ep, sig] = (await makeSession(S)).split(".");
  assert.equal(await verifySession(`${Math.floor(Date.now() / 1000) + 99999999}.${ep}.${sig}`, S), false);
});
test("cookie rỗng/rác bị từ chối", async () => {
  for (const t of [undefined, "", "abc", "1.2.3", "x.y", "1.2", "1.x.3", "9999999999.0."]) assert.equal(await verifySession(t, S), false);
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

test("sign-out-everywhere: a session from an older epoch is rejected, the current epoch works", async () => {
  const old = await makeSession(S, 3);
  assert.equal(await verifySession(old, S, 3), true);
  assert.equal(await verifySession(old, S, 4), false);   // epoch bumped after a password change
  assert.equal(await verifySession(await makeSession(S, 4), S, 4), true);
});
test("the epoch inside the cookie cannot be edited to match", async () => {
  const [exp, , sig] = (await makeSession(S, 3)).split(".");
  assert.equal(await verifySession(`${exp}.4.${sig}`, S, 4), false);
});
