import { cache } from "react";
import { headers } from "next/headers";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { all, run } from "./db.ts";
import { LANGS, detectLang, detectRegion, isLang, translator, type Lang, type T } from "./i18n/index.ts";
import { makeFmt, type DistanceUnit, type Fmt } from "./format.ts";
import { setTz } from "./util.ts";

export interface Settings {
  /** Giá trị đã lưu: một ngôn ngữ cụ thể hoặc "auto" (theo trình duyệt). */
  langSetting: Lang | "auto";
  /** Ngôn ngữ đang dùng (đã giải quyết "auto"). */
  lang: Lang;
  currency: string;
  distance: DistanceUnit;
  taxLabel: string;
  timezone: string;
  reminderHour: number;
  /** Người dùng đã tự mở Cài đặt và lưu (chứ không phải mặc định đoán lần đầu). */
  confirmed: boolean;
}

const REGION_CURRENCY: Record<string, string> = {
  VN: "VND", US: "USD", GB: "GBP", AU: "AUD", CA: "CAD", NZ: "NZD", SG: "SGD", JP: "JPY", KR: "KRW", CN: "CNY", IN: "INR",
  TH: "THB", MY: "MYR", ID: "IDR", PH: "PHP", CH: "CHF", SE: "SEK", NO: "NOK", DK: "DKK", PL: "PLN", BR: "BRL", MX: "MXN",
  DE: "EUR", FR: "EUR", ES: "EUR", IT: "EUR", NL: "EUR", BE: "EUR", IE: "EUR", PT: "EUR", AT: "EUR", FI: "EUR",
};
const MILE_REGIONS = new Set(["US", "GB", "LR", "MM"]);

/** Giá trị mặc định lần chạy đầu, đoán từ trình duyệt/vị trí của người mở app đầu tiên. */
function firstRunDefaults(acceptLanguage: string | null) {
  const lang = detectLang(acceptLanguage);
  const region = detectRegion(acceptLanguage);
  let tz = lang === "vi" ? "Asia/Ho_Chi_Minh" : "UTC";
  try { tz = (getCloudflareContext().cf as { timezone?: string } | undefined)?.timezone || tz; } catch { /* ngoài request */ }
  return {
    lang: "auto",
    currency: (region && REGION_CURRENCY[region]) || (lang === "vi" ? "VND" : "USD"),
    distance: region && MILE_REGIONS.has(region) ? "mi" : "km",
    tax_label: lang === "vi" ? "VAT" : "Tax",
    timezone: tz,
    reminder_hour: "8",
  } as Record<string, string>;
}

const VALID_CURRENCY = (c: string) => { try { new Intl.NumberFormat("en", { style: "currency", currency: c }); return true; } catch { return false; } };
const VALID_TZ = (z: string) => { try { new Intl.DateTimeFormat("en", { timeZone: z }); return true; } catch { return false; } };

/** Đọc cài đặt (lần đầu thì tự tạo mặc định). Gọi nhiều lần trong một request chỉ truy vấn một lần. */
export const getSettings = cache(async (): Promise<Settings> => {
  let rows = await all<{ key: string; value: string }>("SELECT key, value FROM settings");
  let m = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  let al: string | null = null;
  try { al = (await headers()).get("accept-language"); } catch { /* cron / ngoài request */ }
  if (!m.currency) {
    const d = firstRunDefaults(al);
    // chỉ chốt mặc định khi yêu cầu đến từ trình duyệt thật (có Accept-Language); cron/health-check không được quyết định thay người dùng
    if (al) {
      for (const [k, v] of Object.entries(d)) await run("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)", k, v);
      rows = await all("SELECT key, value FROM settings");
      m = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    } else m = { ...m, ...d };
  }
  const langSetting: Lang | "auto" = isLang(m.lang) ? m.lang : "auto";
  let lang: Lang;
  if (langSetting !== "auto") lang = langSetting;
  else if (al) {
    lang = detectLang(al);
    if (m.detected_lang !== lang) await run("INSERT INTO settings (key, value) VALUES ('detected_lang', ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value", lang);
  } else lang = isLang(m.detected_lang) ? m.detected_lang : "en"; // cron: dùng ngôn ngữ lần mở app gần nhất
  const timezone = VALID_TZ(m.timezone) ? m.timezone : "UTC";
  setTz(timezone);
  return {
    langSetting, lang, currency: VALID_CURRENCY(m.currency) ? m.currency : "USD",
    distance: m.distance === "mi" ? "mi" : "km", taxLabel: m.tax_label || "Tax", timezone,
    reminderHour: Math.min(23, Math.max(0, Number(m.reminder_hour ?? 8) || 0)),
    confirmed: m.confirmed === "1",
  };
});

export interface I18n { t: T; fmt: Fmt; lang: Lang; settings: Settings }

/** Hàm dịch + bộ định dạng cho request hiện tại (server). */
export async function getI18n(): Promise<I18n> {
  const settings = await getSettings();
  const locale = LANGS[settings.lang].locale;
  return {
    t: translator(settings.lang), lang: settings.lang, settings,
    fmt: makeFmt({ locale, currency: settings.currency, distance: settings.distance, taxLabel: settings.taxLabel }),
  };
}

export async function saveSettings(v: { lang: string; currency: string; distance: string; taxLabel: string; timezone: string; reminderHour: number }): Promise<void> {
  const put = (k: string, val: string) => run("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value", k, val);
  await put("lang", v.lang === "auto" || isLang(v.lang) ? v.lang : "auto");
  const cur = v.currency.trim().toUpperCase();
  if (VALID_CURRENCY(cur)) await put("currency", cur);
  await put("distance", v.distance === "mi" ? "mi" : "km");
  await put("tax_label", v.taxLabel.trim().slice(0, 20) || "Tax");
  if (VALID_TZ(v.timezone)) await put("timezone", v.timezone);
  await put("reminder_hour", String(Math.min(23, Math.max(0, Math.round(v.reminderHour) || 0))));
  await put("confirmed", "1");
}
