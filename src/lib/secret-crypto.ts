// Pure helpers (no framework imports) for storing integration keys: field catalog, validation, masking, AES-GCM.

/** Keys that can be entered in the app. `group` only affects how the Settings page lays them out. */
export const KEY_FIELDS = [
  { name: "GEMINI_API_KEY", group: "ai", valid: /^[\w.-]{20,200}$/ },
  { name: "ANTHROPIC_API_KEY", group: "ai", valid: /^sk-[\w-]{16,300}$/ },
  { name: "DEEPSEEK_API_KEY", group: "ai", valid: /^sk-[\w-]{16,300}$/ },
  { name: "TELEGRAM_BOT_TOKEN", group: "tg", valid: /^\d{5,}:[\w-]{20,100}$/ },
  { name: "TELEGRAM_CHAT_ID", group: "tg", valid: /^(-?\d{3,20}|@\w{3,64})$/ },
] as const;
export type KeyName = (typeof KEY_FIELDS)[number]["name"];
export const isKeyName = (n: string): n is KeyName => KEY_FIELDS.some((f) => f.name === n);

/** Trim and drop wrapping quotes / stray whitespace people pick up when copying. */
export const cleanKeyValue = (v: string): string => v.trim().replace(/^["'`]+|["'`]+$/g, "").replace(/\s+/g, "");

export function validateKey(name: KeyName, raw: string): string | null {
  const v = cleanKeyValue(raw);
  const f = KEY_FIELDS.find((x) => x.name === name)!;
  return f.valid.test(v) ? v : null;
}

/** Show only that a value exists plus its last 4 characters. */
export const maskKey = (v: string): string => `••••${v.slice(-4)}`;

const enc = new TextEncoder();
const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function aesKey(secret: string): Promise<CryptoKey> {
  const raw = await crypto.subtle.digest("SHA-256", enc.encode(`servicebook-secrets-v1:${secret}`));
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

/** Encrypt `plain` for storage under `name` (the name is authenticated, so values can't be swapped between rows). */
export async function encryptSecret(secret: string, name: string, plain: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: enc.encode(name) }, await aesKey(secret), enc.encode(plain)));
  return `v1.${b64(iv)}.${b64(ct)}`;
}

/** Returns the plaintext, or null if the value is malformed, tampered with, or the secret changed. */
export async function decryptSecret(secret: string, name: string, stored: string): Promise<string | null> {
  try {
    const [v, iv, ct] = stored.split(".");
    if (v !== "v1" || !iv || !ct) return null;
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(iv), additionalData: enc.encode(name) }, await aesKey(secret), unb64(ct));
    return new TextDecoder().decode(pt);
  } catch {
    return null;
  }
}
