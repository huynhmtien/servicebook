import { getI18n } from "./settings.ts";
import type { T } from "./i18n/index.ts";

/** Giá trị dán vào biến môi trường hay dính khoảng trắng / xuống dòng / dấu ngoặc kép → làm sạch. */
const clean = (v?: string) => (v ?? "").trim().replace(/^["']|["']$/g, "").trim();
const token = () => clean(process.env.TELEGRAM_BOT_TOKEN);
const chat = () => clean(process.env.TELEGRAM_CHAT_ID);
const base = () => process.env.TELEGRAM_API_BASE || "https://api.telegram.org";

export const telegramConfigured = () => !!token() && !!chat();

interface TgResult { ok: boolean; status: number; description?: string; result?: { username?: string } }

async function call(method: string, body?: unknown): Promise<TgResult> {
  try {
    const res = await fetch(`${base()}/bot${token()}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body ?? {}),
      signal: AbortSignal.timeout(15_000),
    });
    const j = (await res.json().catch(() => ({}))) as { ok?: boolean; description?: string; result?: { username?: string } };
    return { ok: !!res.ok && j.ok !== false, status: res.status, description: j.description, result: j.result };
  } catch (e) {
    return { ok: false, status: 0, description: e instanceof Error ? e.message : String(e) };
  }
}

/** Dịch lỗi Telegram sang lời khuyên cụ thể (theo ngôn ngữ đang dùng). */
export function hint(t: T, status: number, description = "", stage: "token" | "send"): string {
  const d = description.toLowerCase();
  if (status === 0) return t("tg.hint_network", { detail: description });
  if (status === 401 || (stage === "token" && status === 404)) return t("tg.hint_token");
  if (d.includes("chat not found") || d.includes("chat_id is empty")) return t("tg.hint_chat");
  if (d.includes("bots can't send messages to bots")) return t("tg.hint_bot_id");
  if (status === 403) return t("tg.hint_forbidden");
  if (status === 429) return t("tg.hint_rate");
  return t("tg.hint_generic", { status, detail: description || t("tg.unknown") });
}

/** Đăng ký webhook để bot nhận tin trả lời (cập nhật ODO bằng tin nhắn). */
export async function setTelegramWebhook(url: string, secret: string): Promise<{ ok: boolean; error?: string }> {
  const { t } = await getI18n();
  const r = await call("setWebhook", { url, secret_token: secret, allowed_updates: ["message"], drop_pending_updates: true });
  return r.ok ? { ok: true } : { ok: false, error: hint(t, r.status, r.description, "token") };
}

export async function sendTelegram(text: string): Promise<{ ok: boolean; error?: string }> {
  const { t } = await getI18n();
  if (!telegramConfigured()) return { ok: false, error: t("tg.err_no_conf") };
  const r = await call("sendMessage", { chat_id: chat(), text, parse_mode: "HTML", disable_web_page_preview: true });
  return r.ok ? { ok: true } : { ok: false, error: hint(t, r.status, r.description, "send") };
}

export interface Step { ok: boolean; text: string }

/** Kiểm tra từng bước để biết chính xác hỏng ở đâu. */
export async function telegramDiagnose(): Promise<{ ok: boolean; steps: Step[] }> {
  const { t } = await getI18n();
  const steps: Step[] = [];
  const tk = token(), c = chat();
  const fin = (ok: boolean) => ({ ok, steps });
  if (!tk) { steps.push({ ok: false, text: t("tg.step_no_token") }); return fin(false); }
  if (!c) { steps.push({ ok: false, text: t("tg.step_no_chat") }); return fin(false); }
  const tokenOk = /^\d+:[\w-]{20,}$/.test(tk);
  steps.push({ ok: tokenOk, text: t(tokenOk ? "tg.step_token_fmt_ok" : "tg.step_token_fmt_bad") });
  const chatOk = /^-?\d+$/.test(c) || /^@\w+$/.test(c);
  steps.push({ ok: chatOk, text: t(chatOk ? "tg.step_chat_fmt_ok" : "tg.step_chat_fmt_bad") });
  const me = await call("getMe");
  if (!me.ok) { steps.push({ ok: false, text: hint(t, me.status, me.description, "token") }); return fin(false); }
  steps.push({ ok: true, text: t("tg.step_bot_ok", { name: me.result?.username ? `: @${me.result.username}` : "" }) });
  const sent = await sendTelegram(t("tg.test_msg"));
  steps.push({ ok: sent.ok, text: sent.ok ? t("tg.step_sent_ok") : sent.error! });
  return fin(sent.ok);
}

export const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
