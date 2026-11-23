import { ping } from "../../../lib/db.ts";
import { getSettings } from "../../../lib/settings.ts";

export const dynamic = "force-dynamic";

/** Diagnostics page: checks config variables and the database connection (without exposing secret values). */
export async function GET() {
  await getSettings(); // loads keys saved in the app
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
