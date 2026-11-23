/** Formats numbers/money/dates/distances by language + settings. Pure (usable on both server and browser). */

export type DistanceUnit = "km" | "mi";

export interface FmtOptions { locale: string; currency: string; distance: DistanceUnit; taxLabel: string }

/** Number of decimal digits of a currency (VND/JPY = 0, USD/EUR = 2, KWD = 3). */
export function currencyDigits(currency: string): number {
  try {
    return new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;
  } catch {
    return 2;
  }
}

/**
 * Parse an amount typed by the user (may use any thousands/decimal separator style) → smallest unit (integer).
 * Rule: the last `.`/`,` is the decimal separator if followed by 1..digits digits and the other separator is also present, or it appears only once
 * with fewer than 3 digits after it (1.234 with 2 decimal digits → treated as thousands).
 */
export function parseAmount(input: string, digits: number): number {
  const s = String(input ?? "").trim().replace(/[^\d.,-]/g, "");
  if (!s) return 0;
  const neg = s.startsWith("-");
  const body = s.replace(/-/g, "");
  let intPart = body, frac = "";
  if (digits > 0) {
    const i = Math.max(body.lastIndexOf("."), body.lastIndexOf(","));
    if (i >= 0) {
      const after = body.slice(i + 1);
      if (after.length > 0 && after.length <= digits) { intPart = body.slice(0, i); frac = after; }
    }
  }
  const whole = Number(intPart.replace(/[.,]/g, "")) || 0;
  const f = Number((frac + "0".repeat(digits)).slice(0, digits)) || 0;
  const v = whole * 10 ** digits + f;
  return neg ? -v : v;
}

export interface Fmt {
  locale: string; currency: string; digits: number; unit: DistanceUnit; taxLabel: string;
  num: (n: number) => string;
  money: (minor: number) => string;
  date: (ymd: string | null | undefined) => string;
  dist: (n: number) => string;
  /** Value pre-filled into a money input (major unit, no thousands grouping). */
  amountInput: (minor: number | null | undefined) => string;
  parse: (s: string) => number;
}

export function makeFmt(o: FmtOptions): Fmt {
  const digits = currencyDigits(o.currency);
  const nf = new Intl.NumberFormat(o.locale, { maximumFractionDigits: 2 });
  const mf = new Intl.NumberFormat(o.locale, { style: "currency", currency: o.currency, minimumFractionDigits: digits, maximumFractionDigits: digits });
  const df = new Intl.DateTimeFormat(o.locale, { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
  const num = (n: number) => nf.format(Math.round(n * 100) / 100);
  return {
    locale: o.locale, currency: o.currency, digits, unit: o.distance, taxLabel: o.taxLabel,
    num,
    money: (minor) => mf.format(minor / 10 ** digits),
    date: (d) => (d ? df.format(new Date(`${d}T00:00:00Z`)) : "—"),
    dist: (n) => `${num(n)} ${o.distance}`,
    amountInput: (minor) => {
      if (!minor) return "";
      const v = (minor / 10 ** digits).toFixed(digits);
      return digits > 0 ? v.replace(/\.?0+$/, "") : v; // only trim redundant trailing zeros of the decimal part
    },
    parse: (s) => parseAmount(s, digits),
  };
}
