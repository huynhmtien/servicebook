import { all, get, run } from "./db.ts";
import { listVehicles, activeAlerts, type RuleRow } from "./queries.ts";
import { sendTelegram, telegramConfigured, esc } from "./telegram.ts";
import { getI18n, type I18n } from "./settings.ts";
import { partLabel } from "./parts.ts";
import { daysBetween, today } from "./util.ts";

function line(r: RuleRow, { t, fmt, lang }: I18n): string {
  const parts: string[] = [];
  if (r.kmLeft != null) parts.push(r.kmLeft <= 0 ? t("tg.msg_over_km", { n: fmt.num(-r.kmLeft), unit: fmt.unit }) : t("tg.msg_left_km", { n: fmt.num(r.kmLeft), unit: fmt.unit }));
  if (r.daysLeft != null) parts.push(r.daysLeft <= 0 ? t("tg.msg_over_days", { n: -r.daysLeft }) : t("tg.msg_left_days", { n: r.daysLeft }));
  const icon = r.status === "overdue" ? "🔴" : "🟡";
  const when = r.status === "soon" && r.predictedDate ? t("tg.msg_expected", { date: fmt.date(r.predictedDate) }) : "";
  return `${icon} <b>${esc(partLabel({ key: r.partKey, name: r.partName }, lang))}</b>: ${parts.join(" · ")}${when}`;
}

const escKey = (r: RuleRow) => `esc:${r.ruleId}:${r.status}:${r.last?.date ?? ""}:${r.last?.odo ?? ""}`;

function buildMessage(items: { vehicle: string; plate: string | null; odo: number; rows: RuleRow[] }[], title: string, i18n: I18n) {
  const blocks = items
    .filter((i) => i.rows.length)
    .map((i) => `🚗 <b>${esc(i.vehicle)}</b>${i.plate ? ` (${esc(i.plate)})` : ""} — ${i18n.fmt.dist(i.odo)}\n${i.rows.map((r) => line(r, i18n)).join("\n")}`);
  return blocks.length ? `${title}\n\n${blocks.join("\n\n")}` : null;
}

export type DigestResult = { status: "sent" | "none" | "not_configured" | "error"; error?: string };

/** Gửi tổng hợp hằng ngày: mọi mục quá hạn / sắp tới. `force`: gửi cả tin "mọi thứ ổn". */
export async function sendDigest(force = false): Promise<DigestResult> {
  if (!telegramConfigured()) return { status: "not_configured" };
  const i18n = await getI18n();
  const items = await Promise.all((await listVehicles()).map(async (v) => ({
    vehicle: v.name, plate: v.plate, odo: v.odo, rows: await activeAlerts(v.id),
  })));
  const msg = buildMessage(items, i18n.t("tg.title_digest"), i18n);
  if (!msg) {
    if (force) {
      const ok = await sendTelegram(i18n.t("tg.all_fine"));
      if (!ok.ok) return { status: "error", error: ok.error };
    }
    return { status: "none" };
  }
  const r = await sendTelegram(msg);
  return r.ok ? { status: "sent" } : { status: "error", error: r.error };
}

/** Gửi ngay khi có mục mới chuyển trạng thái (sắp tới / quá hạn); mỗi mức chỉ báo một lần. */
export async function notifyEscalations(): Promise<void> {
  if (!telegramConfigured()) return;
  const i18n = await getI18n();
  const sent = new Set((await all<{ key: string }>("SELECT key FROM notifications WHERE key LIKE 'esc:%'")).map((r) => r.key));
  const items = await Promise.all((await listVehicles()).map(async (v) => {
    const rows = (await activeAlerts(v.id)).filter((r) => !sent.has(escKey(r)));
    return { vehicle: v.name, plate: v.plate, odo: v.odo, rows };
  }));
  const msg = buildMessage(items, i18n.t("tg.title_new"), i18n);
  if (!msg) return;
  const r = await sendTelegram(msg);
  if (!r.ok) return;
  for (const i of items)
    for (const r2 of i.rows) await run("INSERT INTO notifications (key) VALUES (?) ON CONFLICT DO NOTHING", escKey(r2));
}

/** Nhắc cập nhật ODO nếu lần ghi cuối đã quá 14 ngày (mỗi xe tối đa một lần / 7 ngày). Cảnh báo theo km chỉ đúng khi ODO được cập nhật. */
async function nudgeOdometer(): Promise<void> {
  if (!telegramConfigured()) return;
  const i18n = await getI18n();
  for (const v of await listVehicles()) {
    const last = await get<{ d: string | null }>("SELECT MAX(date) AS d FROM odometer_logs WHERE vehicle_id = ?", v.id);
    const age = last?.d ? daysBetween(last.d, today()) : 999;
    if (age < 14) continue;
    if (await get("SELECT 1 FROM notifications WHERE key LIKE ? AND sent_at > datetime('now', '-7 days')", `odo:${v.id}:%`)) continue;
    const r = await sendTelegram(i18n.t("tg.odo_nudge", { vehicle: esc(v.name), odo: i18n.fmt.dist(v.odo), days: age >= 999 ? "—" : String(age) }));
    if (r.ok) await run("INSERT INTO notifications (key) VALUES (?) ON CONFLICT DO NOTHING", `odo:${v.id}:${today()}`);
  }
}

/** Giờ hiện tại (0–23) theo múi giờ cài đặt. */
function localHour(tz: string): number {
  return Number(new Date().toLocaleString("en-GB", { hour: "2-digit", hour12: false, timeZone: tz })) % 24;
}

/**
 * Cron chạy MỖI GIỜ (Cron Trigger): báo mức mới; sau giờ nhắc (cài đặt) thì gửi tổng hợp, mỗi ngày một lần.
 * Cũng dọn bản nháp quét dở quá 7 ngày và lịch sử đăng nhập sai cũ.
 */
export async function runDaily(): Promise<string> {
  const { settings } = await getI18n();
  await run("DELETE FROM drafts WHERE created_at < datetime('now', '-7 days')");
  await run("DELETE FROM login_fails WHERE last_at < ?", Date.now() - 24 * 3600_000);
  await notifyEscalations();
  if (localHour(settings.timezone) < settings.reminderHour) return "before reminder hour";
  await nudgeOdometer();
  const key = `digest:${today()}`;
  if (await get("SELECT 1 FROM notifications WHERE key = ?", key)) return "already sent today";
  const res = await sendDigest();
  if (res.status === "sent" || res.status === "none") await run("INSERT INTO notifications (key) VALUES (?) ON CONFLICT DO NOTHING", key);
  return res.status === "error" ? `error: ${res.error}` : res.status;
}
