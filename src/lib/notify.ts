import { all, get, run } from "./db.ts";
import { listVehicles, activeAlerts, type RuleRow } from "./queries.ts";
import { sendTelegram, telegramConfigured, esc } from "./telegram.ts";
import { fmtDate, num, today } from "./util.ts";

function line(r: RuleRow): string {
  const parts: string[] = [];
  if (r.kmLeft != null) parts.push(r.kmLeft <= 0 ? `quá ${num(-r.kmLeft)} km` : `còn ${num(r.kmLeft)} km`);
  if (r.daysLeft != null) parts.push(r.daysLeft <= 0 ? `quá ${-r.daysLeft} ngày` : `còn ${r.daysLeft} ngày`);
  const icon = r.status === "overdue" ? "🔴" : "🟡";
  const when = r.status === "soon" && r.predictedDate ? ` (dự kiến ${fmtDate(r.predictedDate)})` : "";
  return `${icon} <b>${esc(r.partName)}</b>: ${parts.join(" · ")}${when}`;
}

const escKey = (r: RuleRow) => `esc:${r.ruleId}:${r.status}:${r.last?.date ?? ""}:${r.last?.odo ?? ""}`;

function buildMessage(items: { vehicle: string; plate: string | null; odo: number; rows: RuleRow[] }[], title: string) {
  const blocks = items
    .filter((i) => i.rows.length)
    .map((i) => `🚗 <b>${esc(i.vehicle)}</b>${i.plate ? ` (${esc(i.plate)})` : ""} — ${num(i.odo)} km\n${i.rows.map(line).join("\n")}`);
  return blocks.length ? `${title}\n\n${blocks.join("\n\n")}` : null;
}

/** Gửi tổng hợp hằng ngày: mọi mục quá hạn / sắp tới. */
export async function sendDigest(force = false): Promise<string> {
  if (!telegramConfigured()) return "Chưa cấu hình Telegram";
  const items = await Promise.all((await listVehicles()).map(async (v) => ({
    vehicle: v.name, plate: v.plate, odo: v.odo, rows: await activeAlerts(v.id),
  })));
  const msg = buildMessage(items, "🔔 <b>Nhắc bảo dưỡng</b>");
  if (!msg) {
    if (force) {
      const ok = await sendTelegram("✅ Tất cả hạng mục bảo dưỡng đều ổn.");
      if (!ok.ok) return ok.error!;
    }
    return "Không có cảnh báo";
  }
  const r = await sendTelegram(msg);
  return r.ok ? "Đã gửi" : r.error!;
}

/** Gửi ngay khi có mục mới chuyển trạng thái (sắp tới / quá hạn); mỗi mức chỉ báo một lần. */
export async function notifyEscalations(): Promise<void> {
  if (!telegramConfigured()) return;
  const sent = new Set((await all<{ key: string }>("SELECT key FROM notifications WHERE key LIKE 'esc:%'")).map((r) => r.key));
  const items = await Promise.all((await listVehicles()).map(async (v) => {
    const rows = (await activeAlerts(v.id)).filter((r) => !sent.has(escKey(r)));
    return { vehicle: v.name, plate: v.plate, odo: v.odo, rows };
  }));
  const msg = buildMessage(items, "⚠️ <b>Cảnh báo bảo dưỡng mới</b>");
  if (!msg) return;
  const r = await sendTelegram(msg);
  if (!r.ok) return;
  for (const i of items)
    for (const r2 of i.rows) await run("INSERT INTO notifications (key) VALUES (?) ON CONFLICT DO NOTHING", escKey(r2));
}

/** Dùng cho cron hằng ngày (Cloudflare Cron Trigger): báo mức mới + gửi tổng hợp, mỗi ngày một lần. */
export async function runDaily(): Promise<string> {
  await run("DELETE FROM drafts WHERE created_at < datetime('now', '-7 days')"); // bản nháp quét dở không giữ quá 7 ngày
  await notifyEscalations();
  const key = `digest:${today()}`;
  if (await get("SELECT 1 FROM notifications WHERE key = ?", key)) return "Hôm nay đã gửi";
  const res = await sendDigest();
  if (res === "Đã gửi" || res === "Không có cảnh báo")
    await run("INSERT INTO notifications (key) VALUES (?) ON CONFLICT DO NOTHING", key);
  return res;
}
