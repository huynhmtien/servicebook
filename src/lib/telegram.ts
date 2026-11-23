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

/** Dịch lỗi Telegram sang lời khuyên cụ thể. */
export function hint(status: number, description = "", stage: "token" | "send"): string {
  const d = description.toLowerCase();
  if (status === 0) return `Máy chủ không kết nối được tới Telegram (${description}). Thử lại sau ít phút.`;
  if (status === 401 || (stage === "token" && status === 404))
    return "Token bot sai hoặc đã bị thu hồi. Lấy lại token: Telegram → @BotFather → /mybots → chọn bot → API Token, rồi dán lại vào TELEGRAM_BOT_TOKEN (không có khoảng trắng) và Redeploy.";
  if (d.includes("chat not found") || d.includes("chat_id is empty"))
    return "Chat ID sai, hoặc anh chưa bấm Start với bot. Mở bot trong Telegram, bấm Start (hoặc nhắn 'hi'), rồi lấy số Id từ @userinfobot và dán vào TELEGRAM_CHAT_ID.";
  if (d.includes("bots can't send messages to bots"))
    return "Chat ID đang là Id của một bot. Dùng Id của tài khoản cá nhân anh (lấy từ @userinfobot).";
  if (status === 403) return "Bot chưa được phép nhắn cho anh (chưa Start hoặc đã bị chặn). Mở bot trong Telegram, bỏ chặn và bấm Start.";
  if (status === 429) return "Telegram đang giới hạn tốc độ, đợi một lúc rồi thử lại.";
  return `Telegram trả lỗi ${status}: ${description || "không rõ"}`;
}

export async function sendTelegram(text: string): Promise<{ ok: boolean; error?: string }> {
  if (!telegramConfigured()) return { ok: false, error: "Chưa cấu hình TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID" };
  const r = await call("sendMessage", { chat_id: chat(), text, parse_mode: "HTML", disable_web_page_preview: true });
  return r.ok ? { ok: true } : { ok: false, error: hint(r.status, r.description, "send") };
}

export interface Step { ok: boolean; text: string }

/** Kiểm tra từng bước để biết chính xác hỏng ở đâu. */
export async function telegramDiagnose(): Promise<{ ok: boolean; steps: Step[] }> {
  const steps: Step[] = [];
  const t = token(), c = chat();
  const fin = (ok: boolean) => ({ ok, steps });
  if (!t) { steps.push({ ok: false, text: "Chưa có TELEGRAM_BOT_TOKEN trong cấu hình (nhớ Redeploy sau khi thêm biến)." }); return fin(false); }
  if (!c) { steps.push({ ok: false, text: "Chưa có TELEGRAM_CHAT_ID trong cấu hình (nhớ Redeploy sau khi thêm biến)." }); return fin(false); }
  const tokenOk = /^\d+:[\w-]{20,}$/.test(t);
  steps.push({ ok: tokenOk, text: tokenOk ? "Token đúng định dạng" : "Token sai định dạng (phải dạng 123456789:AAH…, không có khoảng trắng/ký tự lạ)" });
  const chatOk = /^-?\d+$/.test(c) || /^@\w+$/.test(c);
  steps.push({ ok: chatOk, text: chatOk ? "Chat ID đúng định dạng" : "Chat ID sai định dạng (phải là một dãy số, lấy từ @userinfobot)" });
  const me = await call("getMe");
  if (!me.ok) { steps.push({ ok: false, text: hint(me.status, me.description, "token") }); return fin(false); }
  steps.push({ ok: true, text: `Bot hợp lệ${me.result?.username ? `: @${me.result.username}` : ""}` });
  const sent = await sendTelegram("✅ ServiceBook: kết nối Telegram hoạt động.");
  steps.push({ ok: sent.ok, text: sent.ok ? "Đã gửi tin thử — kiểm tra Telegram của anh" : sent.error! });
  return fin(sent.ok);
}

export const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
