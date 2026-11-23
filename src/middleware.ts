import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE, verifySession } from "./lib/auth";
import { getEpoch } from "./lib/credentials";

const PUBLIC = [/^\/login$/, /^\/manifest\.webmanifest$/, /^\/icon-\d+\.png$/, /^\/apple-touch-icon\.png$/, /^\/api\/cron$/, /^\/api\/telegram$/];

/** Set APP_PASSWORD + SESSION_SECRET to enable login (recommended since the app has a public address). */
export async function middleware(req: NextRequest) {
  const pw = process.env.APP_PASSWORD;
  if (!pw) return NextResponse.next();
  const { pathname, search } = req.nextUrl;
  if (PUBLIC.some((r) => r.test(pathname))) return NextResponse.next();
  const secret = process.env.SESSION_SECRET;
  // password enabled but signing key missing → reject everything (safer than leaving it open)
  if (!secret) return new NextResponse("Thiếu SESSION_SECRET — xem HUONG-DAN.md", { status: 503 });
  const token = req.cookies.get(AUTH_COOKIE)?.value;
  if (await verifySession(token, secret, await getEpoch())) return NextResponse.next();
  // not valid for the (possibly stale) remembered epoch: re-read it before rejecting, so a freshly issued session is accepted at once
  if (token && (await verifySession(token, secret, await getEpoch(true)))) return NextResponse.next();
  if (req.method !== "GET") return new NextResponse("Cần đăng nhập", { status: 401 });
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
