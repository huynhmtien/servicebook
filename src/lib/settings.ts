import { cache } from "react";
import { headers } from "next/headers";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { all, run } from "./db.ts";
import { LANGS, detectLang, detectRegion, isLang, translator, type Lang, type T } from "./i18n/index.ts";
import { makeFmt, type DistanceUnit, type Fmt } from "./format.ts";
import { setTz } from "./util.ts";
import { loadSecrets } from "./secrets.ts";

export interface Settings {
  /** Saved value: a specific language or "auto" (follow the browser). */
  langSetting: Lang | "auto";
  /** Language in use (with "auto" resolved). */
  lang: Lang;
  currency: string;
  distance: DistanceUnit;
  taxLabel: string;
  timezone: string;
  reminderHour: number;
  /** The user opened Settings and saved (as opposed to the first-run guessed defaults). */
  confirmed: boolean;
}

const REGION_CURRENCY: Record<string, string> = {
  VN: "VND", US: "USD", GB: "GBP", AU: "AUD", CA: "CAD", NZ: "NZD", SG: "SGD", JP: "JPY", KR: "KRW", CN: "CNY", IN: "INR",
  TH: "THB", MY: "MYR", ID: "IDR", PH: "PHP", CH: "CHF", SE: "SEK", NO: "NOK", DK: "DKK", PL: "PLN", BR: "BRL", MX: "MXN",
  DE: "EUR", FR: "EUR", ES: "EUR", IT: "EUR", NL: "EUR", BE: "EUR", IE: "EUR", PT: "EUR", AT: "EUR", FI: "EUR",
};
const MILE_REGIONS = new Set(["US", "GB", "LR", "MM"]);

/** First-run defaults, guessed from the browser/location of whoever opens the app first. */
function firstRunDefaults(acceptLanguage: string | null) {
  const lang = detectLang(acceptLanguage);
  const region = detectRegion(acceptLanguage);
  let tz = lang === "vi" ? "Asia/Ho_Chi_Minh" : "UTC";
  try { tz = (getCloudflareContext().cf as { timezone?: string } | undefined)?.timezone || tz; } catch { /* outside a request */ }
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

/** Read settings (created with defaults on first use). Calling it several times in one request queries only once. */
export const getSettings = cache(async (): Promise<Settings> => {
  await loadSecrets(); // keys saved in the app → process.env, before anything reads them
  let rows = await all<{ key: string; value: string }>("SELECT key, value FROM settings");
  let m = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  let al: string | null = null;
  try { al = (await headers()).get("accept-language"); } catch { /* cron / outside a request */ }
  if (!m.currency) {
    const d = firstRunDefaults(al);
    // only lock in defaults when the request comes from a real browser (has Accept-Language); cron/health-checks must not decide for the user
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
  } else lang = isLang(m.detected_lang) ? m.detected_lang : "en"; // cron: use the language from the most recent app open
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

/** Translation function + formatter for the current request (server). */
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
