import { ping } from "../../../lib/db.ts";

export const dynamic = "force-dynamic";

/** Trang chẩn đoán: kiểm tra biến cấu hình và kết nối database (không lộ giá trị bí mật). */
export async function GET() {
  const env = process.env;
  const flags = {
    APP_PASSWORD: !!env.APP_PASSWORD,
    SESSION_SECRET: !!env.SESSION_SECRET,
    CRON_SECRET: !!env.CRON_SECRET,
    TELEGRAM: !!env.TELEGRAM_BOT_TOKEN && !!env.TELEGRAM_CHAT_ID,
    AI_KEY: !!(env.GEMINI_API_KEY || env.DEEPSEEK_API_KEY || env.ANTHROPIC_API_KEY),
  };
  let database = "ok";
  try {
    await ping();
  } catch (e) {
    database = String(e instanceof Error ? e.message : e).slice(0, 300);
  }
  return Response.json({ database, flags });
}
