// The hourly cron call authenticates with a secret derived from SESSION_SECRET, so deployers don't have to invent a second one.
// (A CRON_SECRET Worker secret, if set, is still accepted for backward compatibility.) Pure WebCrypto: used by worker.ts and the route.
export async function derivedCronSecret(sessionSecret: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(sessionSecret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode("servicebook-cron-v1")));
  return [...sig].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 48);
}
