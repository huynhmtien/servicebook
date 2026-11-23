import { get, run } from "./db.ts";
import { passwordMatches } from "./auth.ts";
import { hashPassword, verifyPasswordHash } from "./password.ts";

/**
 * Who may sign in.
 * - Initially: the APP_PASSWORD Worker secret.
 * - After "Change password" in Settings: a salted hash in the database replaces it (the old APP_PASSWORD stops working).
 *   Forgot it / SESSION_SECRET changed? Delete the row and APP_PASSWORD works again:
 *   wrangler d1 execute <db> --remote --command "DELETE FROM settings WHERE key='pw_hash'"
 */
export async function checkPassword(input: string): Promise<boolean> {
  const row = await get<{ value: string }>("SELECT value FROM settings WHERE key = 'pw_hash'");
  if (row) return verifyPasswordHash(input, row.value, process.env.SESSION_SECRET ?? "");
  const real = process.env.APP_PASSWORD;
  return !!real && passwordMatches(input, real);
}

export async function setPassword(newPassword: string): Promise<void> {
  const hash = await hashPassword(newPassword, process.env.SESSION_SECRET ?? "");
  await run("INSERT INTO settings (key, value) VALUES ('pw_hash', ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value", hash);
}

/** Session epoch: a counter in the database. Cookies carry the epoch they were issued under; bumping it signs everyone out. */
let cache: { v: number; at: number } | null = null;
const TTL_MS = 5_000; // short memo so every request doesn't hit the database (other isolates notice a bump within seconds)

/**
 * Fails closed (-1: no cookie can match) if the database cannot be read.
 * `fresh` skips the memo: used before rejecting a cookie, because the middleware and the server actions are separate bundles
 * with separate memos, so a brand-new session may carry an epoch this bundle has not seen yet.
 */
export async function getEpoch(fresh = false): Promise<number> {
  if (!fresh && cache && Date.now() - cache.at < TTL_MS) return cache.v;
  try {
    const r = await get<{ value: string }>("SELECT value FROM settings WHERE key = 'session_epoch'");
    const v = Number(r?.value ?? 0) || 0;
    cache = { v, at: Date.now() };
    return v;
  } catch {
    return -1;
  }
}

export async function bumpEpoch(): Promise<number> {
  await run("INSERT INTO settings (key, value) VALUES ('session_epoch', '1') ON CONFLICT (key) DO UPDATE SET value = CAST(CAST(value AS INTEGER) + 1 AS TEXT)");
  cache = null;
  return getEpoch();
}
