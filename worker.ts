// Điểm vào của Worker: giao mọi yêu cầu web cho Next.js (OpenNext), thêm bộ lập lịch cho Cron Trigger.
// @ts-expect-error: file này do `opennextjs-cloudflare build` sinh ra
import handler from "./.open-next/worker.js";

export default {
  fetch: handler.fetch,

  /** Cron Trigger (wrangler.jsonc → triggers.crons): gọi lại chính route /api/cron để dùng chung một đường xử lý. */
  async scheduled(_event: ScheduledController, env: CloudflareEnv & { CRON_SECRET?: string }, ctx: ExecutionContext) {
    const req = new Request("https://servicebook.internal/api/cron", {
      headers: { authorization: `Bearer ${env.CRON_SECRET ?? ""}` },
    });
    ctx.waitUntil(handler.fetch(req, env, ctx).then(async (r: Response) => console.log("[cron]", r.status, await r.text())));
  },
} satisfies ExportedHandler<CloudflareEnv>;

// các Durable Object mà OpenNext sinh ra (nếu có) phải được xuất ra từ file điểm vào
// @ts-expect-error: file do build sinh ra
export { DOQueueHandler, DOShardedTagCache } from "./.open-next/worker.js";
