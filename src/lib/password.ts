// Password hashing for the in-app "change password" feature (pure: WebCrypto only, unit-testable).
//
// Format: pbkdf2-sha256$<iterations>$<salt b64>$<hash b64>
// - The iteration count is stored in the hash, so it can be raised later without invalidating old passwords.
// - 20,000 iterations is about 3-4 ms: the Workers free plan allows 10 ms CPU per request, so we cannot go much higher there.
//   The weaker stretching is compensated by a server-side "pepper" (SESSION_SECRET is mixed in): a copy of the
//   database alone is useless for guessing passwords. Logins are also rate-limited (see actions.ts).
import { safeEqual } from "./auth.ts";

export const PASSWORD_ITERATIONS = 20_000;
export const MIN_PASSWORD_LENGTH = 8;

const enc = new TextEncoder();
const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const unb64 = (s: string): Uint8Array<ArrayBuffer> => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function derive(password: string, pepper: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", enc.encode(`${pepper}\0${password}`), "PBKDF2", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations, hash: "SHA-256" }, key, 256));
}

export async function hashPassword(password: string, pepper: string, iterations = PASSWORD_ITERATIONS): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(new ArrayBuffer(16)));
  return `pbkdf2-sha256$${iterations}$${b64(salt)}$${b64(await derive(password, pepper, salt, iterations))}`;
}

export async function verifyPasswordHash(password: string, stored: string, pepper: string): Promise<boolean> {
  try {
    const [alg, it, salt, hash] = stored.split("$");
    const iterations = Number(it);
    if (alg !== "pbkdf2-sha256" || !Number.isInteger(iterations) || iterations < 1000 || iterations > 1_000_000 || !salt || !hash) return false;
    return safeEqual(b64(await derive(password, pepper, unb64(salt), iterations)), hash);
  } catch {
    return false;
  }
}

/** null = acceptable; otherwise a reason code the UI translates. */
export function passwordProblem(next: string, current: string): "short" | "same" | null {
  if (next.length < MIN_PASSWORD_LENGTH) return "short";
  if (next === current) return "same";
  return null;
}
