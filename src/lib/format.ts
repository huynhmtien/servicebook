/** Định dạng số/tiền/ngày/quãng đường theo ngôn ngữ + cài đặt. Thuần (dùng được cả ở server lẫn trình duyệt). */

export type DistanceUnit = "km" | "mi";

export interface FmtOptions { locale: string; currency: string; distance: DistanceUnit; taxLabel: string }

/** Số chữ số thập phân của một loại tiền (VND/JPY = 0, USD/EUR = 2, KWD = 3). */
export function currencyDigits(currency: string): number {
  try {
    return new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;
  } catch {
    return 2;
  }
}

/**
 * Đọc số tiền người dùng gõ (có thể có dấu phân cách nghìn/thập phân kiểu bất kỳ) → đơn vị nhỏ nhất (integer).
 * Quy tắc: dấu `.`/`,` cuối cùng là dấu thập phân nếu theo sau là 1..digits chữ số và còn dấu kia hoặc chỉ xuất hiện một lần
 * với ít hơn 3 chữ số theo sau (1.234 với 2 chữ số thập phân → coi là nghìn).
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
  /** Giá trị điền sẵn vào ô nhập tiền (đơn vị chính, không nhóm nghìn). */
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
      return digits > 0 ? v.replace(/\.?0+$/, "") : v; // chỉ cắt số 0 thừa của phần thập phân
    },
    parse: (s) => parseAmount(s, digits),
  };
}
