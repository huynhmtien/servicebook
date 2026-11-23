"use server";
import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { AUTH_COOKIE, SESSION_DAYS, makeSession, passwordMatches, safeNext } from "../lib/auth.ts";
import { revalidatePath } from "next/cache";
import { all, get, run, insert, batch, type Stmt } from "../lib/db.ts";
import { createVehicle, getVehicle, setOdo, setOdoStmts, upsertGarage } from "../lib/queries.ts";
import { extractSlip, scanEnabled, supportedMime } from "../lib/extract.ts";
import { extractIntervalsFromDoc, researchIntervals, type IntervalProposal } from "../lib/intervals.ts";
import { expectedTotal, netFactor } from "../lib/money.ts";
import { notifyEscalations, sendDigest } from "../lib/notify.ts";
import { telegramDiagnose, type Step } from "../lib/telegram.ts";
import { normName, today } from "../lib/util.ts";

/** Quay lại trang kèm thông báo "đã xong" để người dùng luôn thấy phản hồi. */
const done = (path: string, msg: string): never => {
  const sep = path.includes("?") ? "&" : "?";
  redirect(`${path}${sep}ok=${encodeURIComponent(msg)}`);
};

const fail = (path: string, msg: string): never => {
  const sep = path.includes("?") ? "&" : "?";
  redirect(`${path}${sep}error=${encodeURIComponent(msg)}`);
};

const s = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const n = (f: FormData, k: string): number | null => {
  const v = s(f, k).replace(/[.\s]/g, "").replace(",", ".");
  if (v === "") return null;
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
};

export async function addVehicle(f: FormData) {
  const name = s(f, "name");
  if (!name) return;
  const id = await createVehicle({
    name, plate: s(f, "plate") || null, model: s(f, "model") || null,
    year: n(f, "year"), odo: n(f, "odo") ?? 0,
  });
  done(`/vehicles/${id}/setup`, "Đã thêm xe. Nhập lần thay gần nhất của các hạng mục anh nhớ (hoặc bỏ qua).");
}

export async function deleteVehicle(f: FormData) {
  await run("DELETE FROM vehicles WHERE id = ?", Number(f.get("id")));
  revalidatePath("/", "layout");
  done("/vehicles", "Đã xóa xe.");
}

export async function updateVehicle(f: FormData) {
  const id = Number(f.get("id"));
  const name = s(f, "name");
  if (!name) return fail(`/vehicles/${id}`, "Tên xe không được để trống.");
  const odo = n(f, "odo");
  await run("UPDATE vehicles SET name = ?, plate = ?, model = ?, year = ? WHERE id = ?",
    name, s(f, "plate") || null, s(f, "model") || null, n(f, "year"), id);
  const cur = await get<{ odo: number }>("SELECT odo FROM vehicles WHERE id = ?", id);
  if (odo != null && odo >= 0 && cur && odo !== cur.odo) await setOdo(id, odo, today(), true);
  await notifyEscalations();
  revalidatePath("/", "layout");
  done(`/vehicles/${id}`, "Đã lưu thông tin xe.");
}

export async function updateOdo(f: FormData) {
  const id = Number(f.get("vehicle_id"));
  const back = safeNext(String(f.get("back") ?? "/"));
  const km = n(f, "km");
  if (km == null || km < 0) return fail(back, "ODO không hợp lệ — nhập số km, ví dụ 48500.");
  const cur = await get<{ odo: number }>("SELECT odo FROM vehicles WHERE id = ?", id);
  await setOdo(id, km, today(), true);
  await notifyEscalations();
  revalidatePath("/", "layout");
  done(back, cur && km < cur.odo
    ? `Đã chỉnh ODO về ${km.toLocaleString("vi-VN")} km (trước đó ${cur.odo.toLocaleString("vi-VN")} km).`
    : `Đã cập nhật ODO: ${km.toLocaleString("vi-VN")} km.`);
}

export async function saveRules(f: FormData) {
  const vid = Number(f.get("vehicle_id"));
  const stmts: Stmt[] = [];
  for (const r of await all<{ id: number; interval_km: number | null; interval_months: number | null }>(
    "SELECT id, interval_km, interval_months FROM rules WHERE vehicle_id = ?", vid)) {
    const km = n(f, `km_${r.id}`), mo = n(f, `mo_${r.id}`);
    const changed = km !== r.interval_km || mo !== r.interval_months;
    // người dùng tự sửa số → đánh dấu nguồn "anh tự đặt" (hết nhãn mặc định/AI)
    stmts.push([
      `UPDATE rules SET interval_km = ?, interval_months = ?, enabled = ?${changed ? ", source = 'user', source_note = NULL, source_url = NULL" : ""} WHERE id = ?`,
      km, mo, f.get(`on_${r.id}`) ? 1 : 0, r.id]);
  }
  await batch(stmts);
  revalidatePath("/", "layout");
  done(`/vehicles/${vid}`, "Đã lưu chu kỳ.");
}

/** Tra cứu chu kỳ chuẩn theo dòng xe (AI tìm web) → màn hình duyệt. */
export async function researchIntervalsAction(f: FormData) {
  const vid = Number(f.get("vehicle_id"));
  const v = await getVehicle(vid);
  if (!v) return fail("/vehicles", "Không tìm thấy xe.");
  if (!v.model && !v.year) return fail(`/vehicles/${vid}`, "Hãy điền hãng/dòng xe và năm sản xuất (mục “Sửa thông tin xe”) để tra cứu đúng xe.");
  let id: number;
  try {
    const p = await researchIntervals(v);
    id = await insert("INSERT INTO drafts (vehicle_id, data) VALUES (?,?)", vid, JSON.stringify(p));
  } catch (e) {
    return fail(`/vehicles/${vid}`, ("Không tra cứu được chu kỳ. " + (e instanceof Error ? e.message : e)).slice(0, 400));
  }
  redirect(`/vehicles/${vid}/intervals/${id}`);
}

/** Đọc bảng bảo dưỡng chụp từ sổ hướng dẫn → màn hình duyệt. */
export async function scanIntervalDoc(f: FormData) {
  const vid = Number(f.get("vehicle_id"));
  const file = f.get("file");
  if (!(file instanceof File) || file.size === 0) return fail(`/vehicles/${vid}`, "Chưa chọn ảnh bảng bảo dưỡng.");
  const mime = (file as File).type;
  const buf = Buffer.from(await (file as File).arrayBuffer());
  let id: number;
  try {
    if (!supportedMime(mime)) return fail(`/vehicles/${vid}`, "Chỉ hỗ trợ ảnh JPG/PNG/WEBP hoặc PDF.");
    const p = await extractIntervalsFromDoc({ id: vid }, buf, mime); // ảnh chỉ gửi cho AI đọc, không lưu
    id = await insert("INSERT INTO drafts (vehicle_id, data) VALUES (?,?)", vid, JSON.stringify(p));
  } catch (e) {
    return fail(`/vehicles/${vid}`, ("Không đọc được bảng bảo dưỡng. " + (e instanceof Error ? e.message : e)).slice(0, 400));
  }
  redirect(`/vehicles/${vid}/intervals/${id}`);
}

/** Áp dụng các dòng người dùng đã duyệt. */
export async function applyIntervals(f: FormData) {
  const vid = Number(f.get("vehicle_id"));
  const draftId = Number(f.get("draft_id"));
  const d = await get<{ data: string }>("SELECT data FROM drafts WHERE id = ?", draftId);
  if (!d) return fail(`/vehicles/${vid}`, "Phiên duyệt đã hết hạn, hãy tra cứu lại.");
  const p = JSON.parse(d.data) as IntervalProposal;
  const stmts: Stmt[] = [];
  for (const it of p.items) {
    if (!f.get(`apply_${it.part_type_id}`)) continue;
    const km = n(f, `km_${it.part_type_id}`), mo = n(f, `mo_${it.part_type_id}`);
    if (km == null && mo == null) continue;
    stmts.push([
      `UPDATE rules SET interval_km = ?, interval_months = ?, source = ?, source_note = ?, source_url = ?, enabled = 1
       WHERE vehicle_id = ? AND part_type_id = ?`,
      km, mo, p.origin, it.note || null, it.source_url, vid, it.part_type_id]);
  }
  const applied = stmts.length;
  stmts.push(["DELETE FROM drafts WHERE id = ?", draftId]);
  await batch(stmts);
  revalidatePath("/", "layout");
  done(`/vehicles/${vid}`, applied ? `Đã áp dụng chu kỳ cho ${applied} linh kiện.` : "Chưa chọn dòng nào để áp dụng.");
}

/** Dữ liệu ban đầu: mỗi linh kiện nhập lần thay gần nhất (ngày + km). */
export async function saveSetup(f: FormData) {
  const vid = Number(f.get("vehicle_id"));
  const groups = new Map<string, number[]>();
  for (const p of await all<{ id: number }>("SELECT id FROM part_types")) {
    const date = s(f, `date_${p.id}`);
    if (!date) continue;
    const km = n(f, `km_${p.id}`);
    const key = `${date}|${km ?? ""}`;
    groups.set(key, [...(groups.get(key) ?? []), p.id]);
  }
  const names = new Map((await all<{ id: number; name: string }>("SELECT id, name FROM part_types")).map((p) => [p.id, p.name]));
  for (const [key, parts] of groups) {
    const [date, km] = key.split("|");
    const odo = km === "" ? null : Number(km);
    const rid = await insert("INSERT INTO service_records (vehicle_id, date, odo, total, note) VALUES (?,?,?,?,?)",
      vid, date, odo, 0, "Nhập dữ liệu ban đầu");
    await batch([
      ...parts.map((pid): Stmt => ["INSERT INTO service_items (record_id, part_type_id, raw_name, qty, amount, unit_price, kind) VALUES (?,?,?,?,?,?,?)",
        rid, pid, names.get(pid) ?? "", 1, 0, 0, "part"]),
      ...(odo != null ? [["INSERT INTO odometer_logs (vehicle_id, km, date) VALUES (?,?,?)", vid, odo, date] as Stmt] : []),
    ]);
  }
  await notifyEscalations();
  revalidatePath("/", "layout");
  done(`/vehicles/${vid}`, "Đã lưu lần thay ban đầu. Các hạng mục có dữ liệu đã được tính hạn.");
}

const ROWS = 40;

/** Lưu một phiếu (dùng cho nhập tay và duyệt kết quả scan). */
export async function saveRecord(f: FormData) {
  const vid = Number(f.get("vehicle_id"));
  const date = s(f, "date") || today();
  const odo = n(f, "odo");
  const draftId0 = n(f, "draft_id");
  const items: { raw: string; part: number | null; qty: number; amount: number; kind: string }[] = [];
  for (let i = 0; i < ROWS; i++) {
    const raw = s(f, `name_${i}`);
    if (!raw) continue;
    const amount = Math.round(n(f, `amount_${i}`) ?? 0);
    items.push({
      raw, part: n(f, `part_${i}`), qty: n(f, `qty_${i}`) || 1, amount,
      kind: s(f, `kind_${i}`) === "labor" ? "labor" : "part",
    });
  }
  if (items.length === 0) {
    const back = draftId0 ? `/scan/${draftId0}` : "/records/new?manual=1";
    return fail(back, "Phiếu cần ít nhất một hạng mục.");
  }
  const subtotal = items.reduce((a, b) => a + b.amount, 0);
  const discount = Math.max(0, Math.round(n(f, "discount") ?? 0));
  const vat = Math.max(0, Math.round(n(f, "vat") ?? 0));
  const vatRate = n(f, "vat_rate");
  const vatIncluded = s(f, "vat_included") === "1";
  const total = expectedTotal({ sum: subtotal, discount, vat, vatIncluded });
  // giá từng dòng quy về trước thuế để so sánh giữa các garage cho công bằng
  const factor = netFactor(vatRate, vatIncluded);
  const draftId = n(f, "draft_id");

  const gid = await upsertGarage(s(f, "garage"));
  const id = await insert(
    `INSERT INTO service_records (vehicle_id, garage_id, date, odo, total, note, subtotal, discount, vat, vat_rate, vat_included)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    vid, gid, date, odo, total, s(f, "note") || null, subtotal, discount, vat, vatRate, vatIncluded ? 1 : 0,
  );
  const stmts: Stmt[] = [];
  for (const it of items) {
    stmts.push(["INSERT INTO service_items (record_id, part_type_id, raw_name, qty, amount, unit_price, kind) VALUES (?,?,?,?,?,?,?)",
      id, it.part, it.raw, it.qty, it.amount, Math.round((it.amount * factor) / it.qty), it.kind]);
    if (it.part)
      stmts.push(["INSERT INTO part_aliases (alias, part_type_id) VALUES (?,?) ON CONFLICT (alias) DO UPDATE SET part_type_id = excluded.part_type_id",
        normName(it.raw), it.part]);
  }
  if (odo != null) stmts.push(...setOdoStmts(vid, odo, date));
  if (draftId) stmts.push(["DELETE FROM drafts WHERE id = ?", draftId]);
  try {
    await batch(stmts); // các hạng mục + ODO + xóa bản nháp: một transaction
  } catch (e) {
    await run("DELETE FROM service_records WHERE id = ?", id); // không để lại phiếu rỗng
    throw e;
  }
  await notifyEscalations();
  revalidatePath("/", "layout");
  done(`/records/${id}`, "Đã lưu phiếu.");
}

export async function deleteRecord(f: FormData) {
  await run("DELETE FROM service_records WHERE id = ?", Number(f.get("id")));
  revalidatePath("/", "layout");
  done("/records", "Đã xóa phiếu.");
}

export async function scanSlip(f: FormData) {
  if (!scanEnabled()) redirect("/records/new?error=" + encodeURIComponent("Chưa cấu hình khóa AI trong .env"));
  const file = f.get("file");
  const vid = Number(f.get("vehicle_id"));
  if (!(file instanceof File) || file.size === 0) redirect("/records/new?error=" + encodeURIComponent("Chưa chọn file"));
  const buf = Buffer.from(await (file as File).arrayBuffer());
  const mime = (file as File).type;
  if (!supportedMime(mime)) redirect("/records/new?error=" + encodeURIComponent("Chỉ hỗ trợ ảnh JPG/PNG/WEBP hoặc PDF"));
  let id: number;
  try {
    const draft = await extractSlip(buf, mime);
    id = await insert("INSERT INTO drafts (vehicle_id, data) VALUES (?,?)", vid, JSON.stringify(draft));
  } catch (e) {
    console.error("[servicebook] scan lỗi:", e);
    redirect(`/records/new?error=${encodeURIComponent(("Không đọc được phiếu — anh thử lại hoặc nhập tay. Chi tiết: " + (e instanceof Error ? e.message : e)).slice(0, 400))}`);
  }
  redirect(`/scan/${id}`);
}

export interface TgState { ok?: boolean; steps?: Step[]; message?: string }

export async function testTelegram(_prev: TgState, _f: FormData): Promise<TgState> {
  const r = await telegramDiagnose();
  return { ok: r.ok, steps: r.steps };
}

export async function sendDigestNow(_prev: TgState, _f: FormData): Promise<TgState> {
  const r = await sendDigest(true);
  return { ok: r === "Đã gửi" || r === "Không có cảnh báo", message: r === "Không có cảnh báo" ? "Không có cảnh báo nào cần gửi (đã gửi tin xác nhận mọi thứ ổn)." : r === "Đã gửi" ? "Đã gửi tổng hợp cảnh báo — kiểm tra Telegram." : r };
}

const MAX_FAILS = 8, LOCK_MS = 15 * 60_000;

export async function login(f: FormData) {
  const pw = process.env.APP_PASSWORD;
  const secret = process.env.SESSION_SECRET;
  const next = safeNext(String(f.get("next") ?? "/"));
  if (!pw) redirect(next);
  const back = (e: string) => redirect(`/login?error=${e}&next=${encodeURIComponent(next)}`);
  if (!secret) back("config");
  const ip = (await headers()).get("cf-connecting-ip") ?? "local";
  const rec = await get<{ n: number; last_at: number }>("SELECT n, last_at FROM login_fails WHERE ip = ?", ip);
  if (rec && rec.n >= MAX_FAILS && Date.now() - rec.last_at < LOCK_MS) back("locked");
  if (!(await passwordMatches(String(f.get("password") ?? ""), pw))) {
    await run(
      `INSERT INTO login_fails (ip, n, last_at) VALUES (?, 1, ?)
       ON CONFLICT (ip) DO UPDATE SET n = CASE WHEN ? - last_at > ? THEN 1 ELSE n + 1 END, last_at = ?`,
      ip, Date.now(), Date.now(), LOCK_MS, Date.now());
    await new Promise((r) => setTimeout(r, 500)); // làm chậm việc dò mật khẩu
    back("1");
  }
  await run("DELETE FROM login_fails WHERE ip = ?", ip);
  (await cookies()).set(AUTH_COOKIE, await makeSession(secret!), {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * SESSION_DAYS,
  });
  redirect(next);
}

export async function logout() {
  (await cookies()).delete(AUTH_COOKIE);
  redirect("/login");
}
