"use server";
import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { AUTH_COOKIE, SESSION_DAYS, makeSession, safeNext } from "../lib/auth.ts";
import { bumpEpoch, checkPassword, getEpoch, setPassword } from "../lib/credentials.ts";
import { MIN_PASSWORD_LENGTH, passwordProblem } from "../lib/password.ts";
import { revalidatePath } from "next/cache";
import { all, get, run, insert, batch, type Stmt } from "../lib/db.ts";
import { createVehicle, getVehicle, setOdo, setOdoStmts, upsertGarage } from "../lib/queries.ts";
import { aiContext, extractSlip, scanEnabled, supportedMime } from "../lib/extract.ts";
import { extractIntervalsFromDoc, researchIntervals, type IntervalProposal } from "../lib/intervals.ts";
import { expectedTotal, netFactor } from "../lib/money.ts";
import { notifyEscalations, sendDigest } from "../lib/notify.ts";
import { telegramDiagnose, setTelegramWebhook, telegramConfigured, type Step } from "../lib/telegram.ts";
import { webhookSecret } from "../lib/telegram-bot.ts";
import { getI18n, saveSettings } from "../lib/settings.ts";
import { restoreBackup } from "../lib/backup.ts";
import { KEY_FIELDS, validateKey } from "../lib/secret-crypto.ts";
import { canStoreKeys, deleteSecret, loadSecrets, setSecret } from "../lib/secrets.ts";
import { INITIAL_NOTE, normName, today } from "../lib/util.ts";
import { CATEGORIES, COST_ONLY, keywordsFor } from "../lib/parts.ts";
import { FUELS, TRANSMISSIONS, oneOf, specDesc } from "../lib/vehicle-spec.ts";
import { describeDefect, extractVehicle, SEVERITIES } from "../lib/vehicle-ai.ts";

/** Redirect back with a one-off notice in the query string (a #fragment, if any, stays at the end of the URL). */
const withNotice = (path: string, key: "ok" | "error", msg: string): never => {
  const [base, hash] = path.split("#");
  const sep = base.includes("?") ? "&" : "?";
  redirect(`${base}${sep}${key}=${encodeURIComponent(msg)}${hash ? `#${hash}` : ""}`);
};
const done = (path: string, msg: string): never => withNotice(path, "ok", msg);
const fail = (path: string, msg: string): never => withNotice(path, "error", msg);

const s = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
/** Integer (ODO, km, months, year): strips any vi/en thousands separators (48.500 / 48,500 / 48 500). */
const n = (f: FormData, k: string): number | null => {
  const v = s(f, k).replace(/[^\d-]/g, "");
  if (v === "" || v === "-") return null;
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
};
/** Decimal number (quantity, tax rate): accepts either , or . */
const dec = (f: FormData, k: string): number | null => {
  const v = s(f, k).replace(/\s/g, "").replace(",", ".");
  if (v === "") return null;
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
};

export async function addVehicle(f: FormData) {
  const { t, settings } = await getI18n();
  const name = s(f, "name");
  if (!name) return;
  const id = await createVehicle({
    name, plate: s(f, "plate") || null, model: s(f, "model") || null,
    year: n(f, "year"), odo: n(f, "odo") ?? 0, fuel: oneOf(FUELS, s(f, "fuel")),
    transmission: oneOf(TRANSMISSIONS, s(f, "transmission")), engine: s(f, "engine") || null, vin: s(f, "vin") || null,
  }, { distance: settings.distance });
  done(`/vehicles/${id}`, t("act.vehicle_added"));
}

export async function deleteVehicle(f: FormData) {
  const { t } = await getI18n();
  await run("DELETE FROM vehicles WHERE id = ?", Number(f.get("id")));
  revalidatePath("/", "layout");
  done("/vehicles", t("act.vehicle_deleted"));
}

export async function updateVehicle(f: FormData) {
  const { t } = await getI18n();
  const id = Number(f.get("id"));
  const name = s(f, "name");
  if (!name) return fail(`/vehicles/${id}`, t("act.name_required"));
  const odo = n(f, "odo");
  await run("UPDATE vehicles SET name = ?, plate = ?, model = ?, year = ?, fuel = ?, transmission = ?, engine = ?, vin = ? WHERE id = ?",
    name, s(f, "plate") || null, s(f, "model") || null, n(f, "year"), oneOf(FUELS, s(f, "fuel")),
    oneOf(TRANSMISSIONS, s(f, "transmission")), s(f, "engine") || null, s(f, "vin") || null, id);
  const cur = await get<{ odo: number }>("SELECT odo FROM vehicles WHERE id = ?", id);
  if (odo != null && odo >= 0 && cur && odo !== cur.odo) await setOdo(id, odo, today(), true);
  await notifyEscalations();
  revalidatePath("/", "layout");
  done(`/vehicles/${id}`, t("act.vehicle_saved"));
}

export async function updateOdo(f: FormData) {
  const { t, fmt } = await getI18n();
  const id = Number(f.get("vehicle_id"));
  const back = safeNext(String(f.get("back") ?? "/"));
  const km = n(f, "km");
  if (km == null || km < 0) return fail(back, t("act.odo_invalid"));
  const cur = await get<{ odo: number }>("SELECT odo FROM vehicles WHERE id = ?", id);
  await setOdo(id, km, today(), true);
  await notifyEscalations();
  revalidatePath("/", "layout");
  done(back, cur && km < cur.odo
    ? t("act.odo_lowered", { km: fmt.num(km), prev: fmt.num(cur.odo), unit: fmt.unit })
    : t("act.odo_updated", { km: fmt.num(km), unit: fmt.unit }));
}

export async function saveRules(f: FormData) {
  const { t } = await getI18n();
  const vid = Number(f.get("vehicle_id"));
  const stmts: Stmt[] = [];
  for (const r of await all<{ id: number; interval_km: number | null; interval_months: number | null }>(
    "SELECT id, interval_km, interval_months FROM rules WHERE vehicle_id = ?", vid)) {
    const km = n(f, `km_${r.id}`), mo = n(f, `mo_${r.id}`);
    const changed = km !== r.interval_km || mo !== r.interval_months;
    // user edited the number manually → mark the source as "set by user" (clears the default/AI label)
    stmts.push([
      `UPDATE rules SET interval_km = ?, interval_months = ?, enabled = ?${changed ? ", source = 'user', source_note = NULL, source_url = NULL" : ""} WHERE id = ?`,
      km, mo, f.get(`on_${r.id}`) ? 1 : 0, r.id]);
  }
  await batch(stmts);
  revalidatePath("/", "layout");
  done(`/vehicles/${vid}`, t("act.intervals_saved"));
}

/** Look up standard intervals for the vehicle model (AI web search) → review screen. */
export async function researchIntervalsAction(f: FormData) {
  const i18n = await getI18n();
  const { t } = i18n;
  const vid = Number(f.get("vehicle_id"));
  const v = await getVehicle(vid);
  if (!v) return fail("/vehicles", t("act.vehicle_not_found"));
  if (!v.model && !v.year && !v.name) return fail(`/vehicles/${vid}`, t("act.need_model_year"));
  let id: number;
  try {
    const p = await researchIntervals(v, aiContext(i18n));
    id = await insert("INSERT INTO drafts (vehicle_id, data) VALUES (?,?)", vid, JSON.stringify(p));
  } catch (e) {
    return fail(`/vehicles/${vid}`, t("act.research_failed", { detail: e instanceof Error ? e.message : String(e) }).slice(0, 400));
  }
  redirect(`/vehicles/${vid}/intervals/${id}`);
}

/** Read the maintenance table photographed from the owner's manual → review screen. */
export async function scanIntervalDoc(f: FormData) {
  const i18n = await getI18n();
  const { t } = i18n;
  const vid = Number(f.get("vehicle_id"));
  const file = f.get("file");
  if (!(file instanceof File) || file.size === 0) return fail(`/vehicles/${vid}`, t("act.no_doc_file"));
  const mime = (file as File).type;
  const buf = Buffer.from(await (file as File).arrayBuffer());
  let id: number;
  try {
    if (!supportedMime(mime)) return fail(`/vehicles/${vid}`, t("act.bad_mime"));
    const p = await extractIntervalsFromDoc({ id: vid }, buf, mime, aiContext(i18n)); // the image is only sent to the AI to read, not stored
    id = await insert("INSERT INTO drafts (vehicle_id, data) VALUES (?,?)", vid, JSON.stringify(p));
  } catch (e) {
    return fail(`/vehicles/${vid}`, t("act.doc_failed", { detail: e instanceof Error ? e.message : String(e) }).slice(0, 400));
  }
  redirect(`/vehicles/${vid}/intervals/${id}`);
}

/** Apply the rows the user has approved. */
export async function applyIntervals(f: FormData) {
  const { t } = await getI18n();
  const vid = Number(f.get("vehicle_id"));
  const draftId = Number(f.get("draft_id"));
  const d = await get<{ data: string }>("SELECT data FROM drafts WHERE id = ?", draftId);
  if (!d) return fail(`/vehicles/${vid}`, t("act.draft_expired"));
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
  done(`/vehicles/${vid}`, applied ? t("act.intervals_applied", { count: applied }) : t("act.intervals_none"));
}

/** Initial data: for each part, enter the most recent replacement (date + km). */
export async function saveSetup(f: FormData) {
  const { t } = await getI18n();
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
      vid, date, odo, 0, INITIAL_NOTE);
    await batch([
      ...parts.map((pid): Stmt => ["INSERT INTO service_items (record_id, part_type_id, raw_name, qty, amount, unit_price, kind) VALUES (?,?,?,?,?,?,?)",
        rid, pid, names.get(pid) ?? "", 1, 0, 0, "part"]),
      ...(odo != null ? [["INSERT INTO odometer_logs (vehicle_id, km, date) VALUES (?,?,?)", vid, odo, date] as Stmt] : []),
    ]);
  }
  await notifyEscalations();
  revalidatePath("/", "layout");
  done(`/vehicles/${vid}`, t("act.setup_saved"));
}

const ROWS = 40;

/** Save a record (used for manual entry and for reviewing scan results). */
export async function saveRecord(f: FormData) {
  const { t, fmt } = await getI18n();
  const vid = Number(f.get("vehicle_id"));
  const date = s(f, "date") || today();
  const odo = n(f, "odo");
  const draftId0 = n(f, "draft_id");
  const items: { raw: string; part: number | null; qty: number; amount: number; kind: string }[] = [];
  for (let i = 0; i < ROWS; i++) {
    const raw = s(f, `name_${i}`);
    if (!raw) continue;
    const amount = fmt.parse(s(f, `amount_${i}`)); // smallest unit of the currency
    items.push({
      raw, part: n(f, `part_${i}`), qty: dec(f, `qty_${i}`) || 1, amount,
      kind: s(f, `kind_${i}`) === "labor" ? "labor" : "part",
    });
  }
  if (items.length === 0) {
    const back = draftId0 ? `/scan/${draftId0}` : "/records/new?manual=1";
    return fail(back, t("act.slip_needs_item"));
  }
  const subtotal = items.reduce((a, b) => a + b.amount, 0);
  const discount = Math.max(0, fmt.parse(s(f, "discount")));
  const vat = Math.max(0, fmt.parse(s(f, "vat")));
  const vatRate = dec(f, "vat_rate");
  const vatIncluded = s(f, "vat_included") === "1";
  const total = expectedTotal({ sum: subtotal, discount, vat, vatIncluded });
  // convert each line's price to pre-tax so garages can be compared fairly
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
    await batch(stmts); // items + ODO + draft deletion: one transaction
  } catch (e) {
    await run("DELETE FROM service_records WHERE id = ?", id); // don't leave an empty record behind
    throw e;
  }
  await notifyEscalations();
  revalidatePath("/", "layout");
  done(`/records/${id}`, t("act.slip_saved"));
}

export async function deleteRecord(f: FormData) {
  const { t } = await getI18n();
  await run("DELETE FROM service_records WHERE id = ?", Number(f.get("id")));
  revalidatePath("/", "layout");
  done("/records", t("act.slip_deleted"));
}

export async function scanSlip(f: FormData) {
  const i18n = await getI18n();
  const { t } = i18n;
  const err = (m: string): never => redirect("/records/new?error=" + encodeURIComponent(m));
  if (!scanEnabled()) err(t("act.no_ai_key"));
  const file = f.get("file");
  const vid = Number(f.get("vehicle_id"));
  if (!(file instanceof File) || file.size === 0) err(t("act.no_file"));
  const buf = Buffer.from(await (file as File).arrayBuffer());
  const mime = (file as File).type;
  if (!supportedMime(mime)) err(t("act.bad_mime"));
  let id: number;
  try {
    const veh = await getVehicle(vid);
    const draft = await extractSlip(buf, mime, aiContext(i18n), veh ? specDesc(veh) : undefined); // the image is only sent to the AI to read, not stored
    id = await insert("INSERT INTO drafts (vehicle_id, data) VALUES (?,?)", vid, JSON.stringify(draft));
  } catch (e) {
    console.error("[servicebook] scan failed:", e);
    return err(t("act.scan_failed", { detail: e instanceof Error ? e.message : String(e) }).slice(0, 400));
  }
  redirect(`/scan/${id}`);
}

export interface TgState { ok?: boolean; steps?: Step[]; message?: string }

export async function testTelegram(_prev: TgState, _f: FormData): Promise<TgState> {
  const r = await telegramDiagnose();
  return { ok: r.ok, steps: r.steps };
}

export async function sendDigestNow(_prev: TgState, _f: FormData): Promise<TgState> {
  const { t } = await getI18n();
  const r = await sendDigest(true);
  if (r.status === "none") return { ok: true, message: t("tg.digest_empty") };
  if (r.status === "sent") return { ok: true, message: t("tg.digest_sent") };
  return { ok: false, message: r.status === "not_configured" ? t("tg.not_configured") : r.error ?? "" };
}

/** Save API keys / tokens typed into Settings (encrypted in the database; blank = keep, "remove" checkbox = delete). */
export async function saveKeysAction(f: FormData) {
  const { t } = await getI18n();
  if (!canStoreKeys()) return fail("/settings#keys", t("keys.need_password"));
  const label: Record<string, string> = {
    GEMINI_API_KEY: t("keys.f_gemini"), ANTHROPIC_API_KEY: t("keys.f_anthropic"), DEEPSEEK_API_KEY: t("keys.f_deepseek"),
    TELEGRAM_BOT_TOKEN: t("keys.f_tg_token"), TELEGRAM_CHAT_ID: t("keys.f_tg_chat"),
  };
  const writes: (() => Promise<void>)[] = [];
  for (const { name } of KEY_FIELDS) {
    if (f.get(`clear_${name}`)) { writes.push(() => deleteSecret(name)); continue; }
    const raw = s(f, name);
    if (!raw) continue;
    const v = validateKey(name, raw);
    if (!v) return fail("/settings#keys", t("keys.invalid", { field: label[name] }));
    writes.push(() => setSecret(name, v));
  }
  for (const w of writes) await w(); // everything is validated first: nothing is saved if one field is wrong
  await loadSecrets();
  revalidatePath("/", "layout");
  done("/settings#keys", t("keys.saved"));
}

/** Enable receiving replies from the bot (update ODO via message). */
export async function enableTelegramReplies(_prev: TgState, _f: FormData): Promise<TgState> {
  const { t } = await getI18n();
  const secret = await webhookSecret();
  if (!telegramConfigured()) return { ok: false, message: t("tg.not_configured") };
  if (!secret) return { ok: false, message: t("tg.webhook_need_secret") };
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) return { ok: false, message: t("tg.webhook_fail", { detail: "no host" }) };
  const proto = host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https";
  const r = await setTelegramWebhook(`${proto}://${host}/api/telegram`, secret);
  return r.ok ? { ok: true, message: t("tg.webhook_ok") } : { ok: false, message: r.error };
}

/** Save general settings (language, currency, units, tax, time zone, reminder hour). */
export async function saveSettingsAction(f: FormData) {
  const before = await getI18n();
  await saveSettings({
    lang: s(f, "lang"), currency: s(f, "currency"), distance: s(f, "distance"),
    taxLabel: s(f, "tax_label"), timezone: s(f, "timezone"), reminderHour: n(f, "reminder_hour") ?? 8,
  });
  revalidatePath("/", "layout");
  const { t } = await getI18n(); // use the new language for the message
  void before;
  done("/settings", t("set.saved"));
}

/** Restore all data from a JSON backup file. */
export async function restoreAction(f: FormData) {
  const { t } = await getI18n();
  const file = f.get("file");
  if (!(file instanceof File) || file.size === 0) return fail("/settings", t("set.restore_nofile"));
  let counts;
  try {
    counts = await restoreBackup(await file.text());
  } catch {
    return fail("/settings", t("set.restore_bad"));
  }
  revalidatePath("/", "layout");
  done("/settings", t("set.restore_ok", { vehicles: counts.vehicles, records: counts.records }));
}

const MAX_FAILS = 8, LOCK_MS = 15 * 60_000;

const clientKey = async (prefix: string) => `${prefix}${(await headers()).get("cf-connecting-ip") ?? "local"}`;
const isLocked = async (key: string) => {
  const rec = await get<{ n: number; last_at: number }>("SELECT n, last_at FROM login_fails WHERE ip = ?", key);
  return !!rec && rec.n >= MAX_FAILS && Date.now() - rec.last_at < LOCK_MS;
};
const recordFail = async (key: string) => {
  await run(
    `INSERT INTO login_fails (ip, n, last_at) VALUES (?, 1, ?)
     ON CONFLICT (ip) DO UPDATE SET n = CASE WHEN ? - last_at > ? THEN 1 ELSE n + 1 END, last_at = ?`,
    key, Date.now(), Date.now(), LOCK_MS, Date.now());
  await new Promise((r) => setTimeout(r, 500)); // slow down password guessing
};
/** Issue the session cookie for the CURRENT epoch (so it survives only until the next "sign out everywhere"). */
const issueSession = async () => {
  (await cookies()).set(AUTH_COOKIE, await makeSession(process.env.SESSION_SECRET!, await getEpoch()), {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * SESSION_DAYS,
  });
};

export async function login(f: FormData) {
  const next = safeNext(String(f.get("next") ?? "/"));
  if (!process.env.APP_PASSWORD) redirect(next);
  const back = (e: string) => redirect(`/login?error=${e}&next=${encodeURIComponent(next)}`);
  if (!process.env.SESSION_SECRET) back("config");
  const key = await clientKey("");
  if (await isLocked(key)) back("locked");
  if (!(await checkPassword(String(f.get("password") ?? "")))) { await recordFail(key); back("1"); }
  await run("DELETE FROM login_fails WHERE ip = ?", key);
  await issueSession();
  redirect(next);
}

/** Change the password from Settings (needs the current one). Optionally signs out every other device. */
export async function changePasswordAction(f: FormData) {
  const { t } = await getI18n();
  const back = (m: string): never => fail("/settings#password", m);
  if (!process.env.APP_PASSWORD || !process.env.SESSION_SECRET) return back(t("login.config"));
  const key = await clientKey("pw:");
  if (await isLocked(key)) return back(t("login.locked"));
  const cur = String(f.get("current") ?? ""), next = String(f.get("new") ?? ""), again = String(f.get("confirm") ?? "");
  if (!(await checkPassword(cur))) { await recordFail(key); return back(t("set.pw_wrong")); }
  if (next !== again) return back(t("set.pw_mismatch"));
  const problem = passwordProblem(next, cur);
  if (problem === "short") return back(t("set.pw_short", { min: MIN_PASSWORD_LENGTH }));
  if (problem === "same") return back(t("set.pw_same"));
  await run("DELETE FROM login_fails WHERE ip = ?", key);
  await setPassword(next);
  if (f.get("signout_all")) await bumpEpoch(); // every other device must sign in again
  await issueSession(); // this device stays signed in
  done("/settings#password", t(f.get("signout_all") ? "set.pw_changed_all" : "set.pw_changed"));
}

export async function logout() {
  (await cookies()).delete(AUTH_COOKIE);
  redirect("/login");
}


// ---------- registration / inspection paper → vehicle fields (the image is read and discarded, never stored) ----------
/** Read a photo of the registration / inspection certificate and send the user back to the form pre-filled (nothing is saved until they confirm). */
export async function scanRegistration(f: FormData) {
  const i18n = await getI18n();
  const { t } = i18n;
  const vid = Number(f.get("vehicle_id")) || 0;
  const back = vid ? `/vehicles/${vid}` : "/vehicles";
  if (!scanEnabled()) return fail(back, t("act.no_ai_key"));
  const file = f.get("file");
  if (!(file instanceof File) || file.size === 0) return fail(back, t("act.no_file"));
  if (!supportedMime(file.type)) return fail(back, t("act.bad_mime"));
  let reg: string;
  try {
    reg = encodeURIComponent(JSON.stringify(await extractVehicle(Buffer.from(await file.arrayBuffer()), file.type, aiContext(i18n))));
  } catch (e) {
    console.error("[servicebook] registration scan failed:", e);
    return fail(back, t("act.reg_failed", { detail: e instanceof Error ? e.message : String(e) }).slice(0, 400));
  }
  redirect(`${back}?reg=${reg}${vid ? "#edit" : "#add"}`);
}

// ---------- defect / abnormality reports ----------
const THUMB_RE = /^data:image\/(webp|jpeg);base64,[A-Za-z0-9+/=]+$/;

/** Photo (+ optional note) → AI writes a short description → saved straight away with date and ODO. Only a tiny thumbnail is kept. */
export async function createDefect(f: FormData) {
  const i18n = await getI18n();
  const { t } = i18n;
  const vid = Number(f.get("vehicle_id"));
  const v = await getVehicle(vid);
  if (!v) return fail("/defects/new", t("act.vehicle_not_found"));
  const note = s(f, "note").slice(0, 500);
  const file = f.get("file");
  const hasFile = file instanceof File && file.size > 0 && supportedMime(file.type);
  const thumbRaw = s(f, "thumb");
  const thumb = THUMB_RE.test(thumbRaw) && thumbRaw.length <= 90_000 ? thumbRaw : null;
  if (!hasFile && !note) return fail("/defects/new", t("defects.need_input"));

  let ai: Awaited<ReturnType<typeof describeDefect>> | null = null;
  let aiError = "";
  if (hasFile && scanEnabled()) {
    try { ai = await describeDefect(Buffer.from(await (file as File).arrayBuffer()), (file as File).type, aiContext(i18n), specDesc(v), note); }
    catch (e) { console.error("[servicebook] defect describe failed:", e); aiError = e instanceof Error ? e.message : String(e); }
  }
  const title = ai?.title ?? (note ? note.split(/[\n.]/)[0].slice(0, 80) : t("defects.untitled"));
  const id = await insert(
    "INSERT INTO defects (vehicle_id, date, odo, title, description, area, severity, advice, user_note, thumb, ai) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
    vid, today(), v.odo || null, title, ai?.description ?? note, ai?.area ?? null, ai?.severity ?? "medium", ai?.advice ?? null, note || null, thumb, ai ? 1 : 0,
  );
  revalidatePath("/", "layout");
  const msg = ai ? t("defects.saved") : aiError ? t("defects.saved_ai_failed", { detail: aiError.slice(0, 160) }) : t("defects.saved_noai");
  done(`/defects/${id}`, msg);
}

export async function updateDefect(f: FormData) {
  const { t } = await getI18n();
  const id = Number(f.get("id"));
  const title = s(f, "title").slice(0, 120);
  if (!title) return fail(`/defects/${id}`, t("defects.need_title"));
  await run("UPDATE defects SET title = ?, description = ?, user_note = ?, severity = ? WHERE id = ?",
    title, s(f, "description").slice(0, 800), s(f, "note").slice(0, 500) || null, oneOf(SEVERITIES, s(f, "severity")) ?? "medium", id);
  revalidatePath("/", "layout");
  done(`/defects/${id}`, t("defects.updated"));
}

export async function resolveDefect(f: FormData) {
  const { t } = await getI18n();
  const id = Number(f.get("id"));
  if (f.get("reopen")) await run("UPDATE defects SET status = 'open', resolved_at = NULL, resolution = NULL WHERE id = ?", id);
  else await run("UPDATE defects SET status = 'resolved', resolved_at = ?, resolution = ? WHERE id = ?", today(), s(f, "resolution").slice(0, 300) || null, id);
  revalidatePath("/", "layout");
  done(`/defects/${id}`, f.get("reopen") ? t("defects.reopened") : t("defects.resolved_msg"));
}

export async function deleteDefect(f: FormData) {
  const { t } = await getI18n();
  await run("DELETE FROM defects WHERE id = ?", Number(f.get("id")));
  revalidatePath("/", "layout");
  done("/defects", t("defects.deleted"));
}


// ---------- custom parts: the catalog is not fixed ----------
export interface NewPart { id: number; name: string; category: string; kw: string[] }
/**
 * Add a part to the catalog (called from the record form). It is tracked on every vehicle straight away; the interval is optional
 * (leave empty and set it later from the manual or the AI lookup). A part with the same name is reused instead of duplicated.
 */
export async function createPart(input: { name: string; category: string; km?: number | null; months?: number | null }): Promise<NewPart | { error: string }> {
  const name = String(input.name ?? "").replace(/\s+/g, " ").trim().slice(0, 60);
  const category = String(input.category ?? "");
  if (name.length < 2) return { error: "name" };
  if (!(CATEGORIES as readonly string[]).includes(category)) return { error: "category" };
  const existing = (await all<{ id: number; name: string; category: string }>("SELECT id, name, category FROM part_types")).find((p) => normName(p.name) === normName(name));
  const mk = (id: number, nm: string, cat: string): NewPart => ({ id, name: nm, category: cat, kw: keywordsFor(nm) });
  if (existing) return mk(existing.id, existing.name, existing.category);
  const num = (v: unknown) => { const x = Math.round(Number(v)); return Number.isFinite(x) && x > 0 ? x : null; };
  const km = category === COST_ONLY ? null : num(input.km), months = category === COST_ONLY ? null : num(input.months);
  const id = await insert("INSERT INTO part_types (name, category, default_km, default_months) VALUES (?,?,?,?)", name, category, km, months);
  if (category !== COST_ONLY)
    await run("INSERT INTO rules (vehicle_id, part_type_id, interval_km, interval_months, enabled) SELECT id, ?, ?, ?, 1 FROM vehicles", id, km, months);
  revalidatePath("/", "layout");
  return mk(id, name, category);
}
