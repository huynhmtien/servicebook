import { handleTelegramUpdate, verifyWebhook } from "../../../lib/telegram-bot.ts";

export const dynamic = "force-dynamic";

/** Webhook của Telegram. Xác thực bằng header bí mật (secret_token); luôn trả 200 để Telegram không gửi lại. */
export async function POST(req: Request) {
  if (!(await verifyWebhook(req.headers.get("x-telegram-bot-api-secret-token")))) return new Response("Unauthorized", { status: 401 });
  try {
    await handleTelegramUpdate(await req.json());
  } catch (e) {
    console.error("[servicebook] telegram webhook error:", e);
  }
  return new Response("ok");
}
