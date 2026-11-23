import { test } from "node:test";
import assert from "node:assert/strict";
import { hashPassword, verifyPasswordHash, passwordProblem, PASSWORD_ITERATIONS } from "./password.ts";

const PEPPER = "a-long-session-secret-for-tests";

test("hash then verify; wrong password fails", async () => {
  const h = await hashPassword("correct horse battery", PEPPER);
  assert.ok(h.startsWith(`pbkdf2-sha256$${PASSWORD_ITERATIONS}$`) && !h.includes("correct"));
  assert.equal(await verifyPasswordHash("correct horse battery", h, PEPPER), true);
  assert.equal(await verifyPasswordHash("correct horse batterY", h, PEPPER), false);
  assert.equal(await verifyPasswordHash("", h, PEPPER), false);
});
test("a different pepper (SESSION_SECRET) cannot verify the hash", async () => {
  const h = await hashPassword("correct horse battery", PEPPER);
  assert.equal(await verifyPasswordHash("correct horse battery", h, "another-secret"), false);
});
test("every hash has a fresh salt", async () => {
  assert.notEqual(await hashPassword("same-password", PEPPER), await hashPassword("same-password", PEPPER));
});
test("the stored iteration count is honored (old hashes keep working)", async () => {
  const h = await hashPassword("pw-with-fewer-rounds", PEPPER, 5000);
  assert.ok(h.startsWith("pbkdf2-sha256$5000$"));
  assert.equal(await verifyPasswordHash("pw-with-fewer-rounds", h, PEPPER), true);
});
test("malformed or tampered hashes are rejected, never throw", async () => {
  const h = await hashPassword("abc12345", PEPPER);
  const [a, i, s, x] = h.split("$");
  for (const bad of ["", "garbage", "a$b$c$d", `${a}$${i}$${s}`, `md5$${i}$${s}$${x}`, `${a}$10$${s}$${x}`, `${a}$99999999$${s}$${x}`, `${a}$${i}$${s}$AAAA`, `${a}$${i}$!!!$${x}`])
    assert.equal(await verifyPasswordHash("abc12345", bad, PEPPER), false, bad);
});
test("password rules", () => {
  assert.equal(passwordProblem("short", "old-password"), "short");
  assert.equal(passwordProblem("12345678", "old-password"), null);
  assert.equal(passwordProblem("same-password", "same-password"), "same");
});
