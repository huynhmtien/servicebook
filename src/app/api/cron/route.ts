import { runDaily } from "../../../lib/notify.ts";
import { safeEqual } from "../../../lib/auth.ts";

/** Cron Trigger của Cloudflare gọi mỗi ngày (xem wrangler.jsonc + worker.ts). Bảo vệ bằng CRON_SECRET. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || !safeEqual(req.headers.get("authorization") ?? "", `Bearer ${secret}`))
    return new Response("Unauthorized", { status: 401 });
  const result = await runDaily();
  return Response.json({ ok: true, result });
}
