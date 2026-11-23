export const AUTH_COOKIE = "servicebook_auth";
export const SESSION_DAYS = 30;

const enc = new TextEncoder();
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");

async function hmac(secret: string, msg: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", key, enc.encode(msg)));
}

/** Constant-time string comparison (prevents character-by-character guessing). */
export function safeEqual(a: string, b: string): boolean {
  const x = enc.encode(a), y = enc.encode(b);
  let d = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) d |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return d === 0;
}

/** Match the password via HMAC on both sides → password length/content doesn't leak through processing time. */
export async function passwordMatches(input: string, real: string): Promise<boolean> {
  return safeEqual(await hmac("servicebook-pw", input), await hmac("servicebook-pw", real));
}

/** Login session: `expiry.signature`. The signing key is SESSION_SECRET (independent of the password → a leaked cookie can't be reversed into the password). */
export async function makeSession(secret: string, now = Date.now()): Promise<string> {
  const exp = Math.floor(now / 1000) + SESSION_DAYS * 86400;
  return `${exp}.${await hmac(secret, `servicebook:${exp}`)}`;
}

export async function verifySession(token: string | undefined, secret: string, now = Date.now()): Promise<boolean> {
  if (!token) return false;
  const [exp, sig] = token.split(".");
  if (!exp || !sig || !/^\d+$/.test(exp) || Number(exp) * 1000 < now) return false;
  return safeEqual(sig, await hmac(secret, `servicebook:${exp}`));
}

/** Only allow redirecting back to internal paths. */
export const safeNext = (n: string | null | undefined) => (n && n.startsWith("/") && !n.startsWith("//") ? n : "/");
