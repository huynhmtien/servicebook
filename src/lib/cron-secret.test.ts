import { test } from "node:test";
import assert from "node:assert/strict";
import { derivedCronSecret } from "./cron-secret.ts";

test("derived cron secret is deterministic, secret-dependent and long enough", async () => {
  const a = await derivedCronSecret("session-secret-one");
  assert.equal(a, await derivedCronSecret("session-secret-one"));
  assert.notEqual(a, await derivedCronSecret("session-secret-two"));
  assert.match(a, /^[0-9a-f]{48}$/);
  assert.ok(!a.includes("session-secret"));
});
