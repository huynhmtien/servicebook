export const AUTH_COOKIE = "servicebook_auth";
export const SESSION_DAYS = 30;

const enc = new TextEncoder();
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");

async function hmac(secret: string, msg: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", key, enc.encode(msg)));
}

/** So sánh chuỗi không phụ thuộc thời gian (tránh dò từng ký tự). */
export function safeEqual(a: string, b: string): boolean {
  const x = enc.encode(a), y = enc.encode(b);
  let d = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) d |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return d === 0;
}

/** So khớp mật khẩu qua HMAC hai phía → độ dài/nội dung mật khẩu không lộ qua thời gian xử lý. */
export async function passwordMatches(input: string, real: string): Promise<boolean> {
  return safeEqual(await hmac("servicebook-pw", input), await hmac("servicebook-pw", real));
}

/** Phiên đăng nhập: `hạn.chữ-ký`. Khóa ký là SESSION_SECRET (độc lập với mật khẩu → cookie lộ cũng không dò ngược ra mật khẩu). */
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

/** Chỉ cho phép quay về đường dẫn nội bộ. */
export const safeNext = (n: string | null | undefined) => (n && n.startsWith("/") && !n.startsWith("//") ? n : "/");
