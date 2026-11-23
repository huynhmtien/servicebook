import { handleTelegramUpdate, verifyWebhook } from "../../../lib/telegram-bot.ts";

export const dynamic = "force-dynamic";

/** Telegram webhook. Authenticated with a secret header (secret_token); always returns 200 so Telegram doesn't retry. */
export async function POST(req: Request) {
  if (!(await verifyWebhook(req.headers.get("x-telegram-bot-api-secret-token")))) return new Response("Unauthorized", { status: 401 });
  try {
    await handleTelegramUpdate(await req.json());
  } catch (e) {
    console.error("[servicebook] telegram webhook error:", e);
  }
  return new Response("ok");
}
