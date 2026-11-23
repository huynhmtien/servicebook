import { all, run } from "./db.ts";
import { KEY_FIELDS, decryptSecret, encryptSecret, isKeyName, maskKey, type KeyName } from "./secret-crypto.ts";

/** Names we copied from the database into process.env (so we can remove them again if the user deletes the key). */
const g = globalThis as unknown as { __sbInjected?: Set<string> };
const injected = (g.__sbInjected ??= new Set<string>());

/** Keys can only be stored when the app is password-protected (otherwise anyone could read/replace them). */
export const canStoreKeys = () => !!process.env.APP_PASSWORD && !!process.env.SESSION_SECRET;

/**
 * Make keys entered in the app available as process.env values, so the rest of the code reads them like Worker secrets.
 * A real Worker secret/env var always wins over a key saved in the app. Safe to call on every request.
 */
export async function loadSecrets(): Promise<void> {
  const secret = process.env.SESSION_SECRET;
  let rows: { name: string; value: string }[] = [];
  try { rows = secret ? await all<{ name: string; value: string }>("SELECT name, value FROM app_secrets") : []; } catch { rows = []; /* table not migrated yet */ }
  const have = new Set<string>();
  for (const r of rows) {
    if (!isKeyName(r.name)) continue;
    if (process.env[r.name] && !injected.has(r.name)) continue; // real env var wins
    const v = await decryptSecret(secret!, r.name, r.value);
    if (v == null) continue;
    process.env[r.name] = v; injected.add(r.name); have.add(r.name);
  }
  for (const n of [...injected]) if (!have.has(n)) { delete process.env[n]; injected.delete(n); }
}

export async function setSecret(name: KeyName, value: string): Promise<void> {
  const secret = process.env.SESSION_SECRET!;
  await run("INSERT INTO app_secrets (name, value) VALUES (?, ?) ON CONFLICT (name) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP", name, await encryptSecret(secret, name, value));
}
export const deleteSecret = (name: KeyName) => run("DELETE FROM app_secrets WHERE name = ?", name);

export interface KeyStatus { name: KeyName; group: "ai" | "tg"; source: "env" | "app" | "none"; masked: string | null }
/** Where each key currently comes from (never returns the value itself, only a masked tail for app-stored keys). */
export function keyStatuses(): KeyStatus[] {
  return KEY_FIELDS.map((f) => {
    const v = process.env[f.name];
    const source = !v ? "none" : injected.has(f.name) ? "app" : "env";
    return { name: f.name, group: f.group, source, masked: source === "app" ? maskKey(v!) : null };
  });
}
