import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE, verifySession } from "./lib/auth";

const PUBLIC = [/^\/login$/, /^\/manifest\.webmanifest$/, /^\/icon-\d+\.png$/, /^\/apple-touch-icon\.png$/, /^\/api\/cron$/, /^\/api\/telegram$/];

/** Đặt APP_PASSWORD + SESSION_SECRET để bật đăng nhập (khuyên dùng vì app có địa chỉ công khai). */
export async function middleware(req: NextRequest) {
  const pw = process.env.APP_PASSWORD;
  if (!pw) return NextResponse.next();
  const { pathname, search } = req.nextUrl;
  if (PUBLIC.some((r) => r.test(pathname))) return NextResponse.next();
  const secret = process.env.SESSION_SECRET;
  // đã bật mật khẩu mà thiếu khóa ký → từ chối hết (an toàn hơn là để mở)
  if (!secret) return new NextResponse("Thiếu SESSION_SECRET — xem HUONG-DAN.md", { status: 503 });
  if (await verifySession(req.cookies.get(AUTH_COOKIE)?.value, secret)) return NextResponse.next();
  if (req.method !== "GET") return new NextResponse("Cần đăng nhập", { status: 401 });
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
