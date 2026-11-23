import { all } from "./db.ts";
import { setOdo } from "./queries.ts";
import { esc, sendTelegram } from "./telegram.ts";
import { getI18n } from "./settings.ts";
import { notifyEscalations } from "./notify.ts";
import { safeEqual } from "./auth.ts";
import { today } from "./util.ts";
import { parseOdoMessage, type V } from "./odo-parse.ts";

/** Webhook secret key: derived from SESSION_SECRET (or CRON_SECRET) so no extra configuration is needed. */
export async function webhookSecret(): Promise<string | null> {
  const base = process.env.SESSION_SECRET || process.env.CRON_SECRET;
  if (!base) return null;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(base), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode("servicebook-telegram-webhook"));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 64);
}

export async function verifyWebhook(headerValue: string | null): Promise<boolean> {
  const s = await webhookSecret();
  return !!s && !!headerValue && safeEqual(headerValue, s);
}

/** Handle a Telegram message sent to the bot. Only accepted from the app owner's TELEGRAM_CHAT_ID. */
export async function handleTelegramUpdate(update: { message?: { chat?: { id?: number | string }; text?: string } }): Promise<void> {
  const msg = update.message;
  const chatId = String(process.env.TELEGRAM_CHAT_ID ?? "").trim().replace(/^["']|["']$/g, "");
  if (!msg?.text || !chatId || String(msg.chat?.id) !== chatId) return;
  const { t, fmt } = await getI18n();
  const text = msg.text.trim();
  if (/^\/(start|help|odo)\b/i.test(text)) { await sendTelegram(t("tg.odo_help")); return; }
  const vehicles = await all<V>("SELECT id, name, plate, odo FROM vehicles ORDER BY id");
  const r = parseOdoMessage(text, vehicles);
  if (r.kind === "none") { await sendTelegram(t("tg.odo_help")); return; }
  if (r.kind === "which") { await sendTelegram(t("tg.odo_which", { list: vehicles.map((v) => `• ${esc(v.name)}`).join("\n") })); return; }
  await setOdo(r.vehicle.id, r.km, today(), true);
  await sendTelegram(t("tg.odo_updated", { vehicle: esc(r.vehicle.name), odo: fmt.dist(r.km) }));
  await notifyEscalations();
}
