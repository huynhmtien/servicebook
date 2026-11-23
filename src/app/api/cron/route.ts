import { runDaily } from "../../../lib/notify.ts";
import { safeEqual } from "../../../lib/auth.ts";
import { derivedCronSecret } from "../../../lib/cron-secret.ts";

/** Called every hour by the Cron Trigger (see wrangler.jsonc + worker.ts). Protected by CRON_SECRET, or a secret derived from SESSION_SECRET. */
export async function GET(req: Request) {
  const got = req.headers.get("authorization") ?? "";
  const accepted: string[] = [];
  if (process.env.CRON_SECRET) accepted.push(process.env.CRON_SECRET);
  if (process.env.SESSION_SECRET) accepted.push(await derivedCronSecret(process.env.SESSION_SECRET));
  if (!accepted.some((s) => safeEqual(got, `Bearer ${s}`))) return new Response("Unauthorized", { status: 401 });
  const result = await runDaily();
  return Response.json({ ok: true, result });
}
