/** Runtime time zone: taken from settings (settings.ts calls setTz on every request); the app has a single owner so a global value is safe. */
let TZ = process.env.APP_TZ || "UTC";
/** Fixed marker (language-independent) for records created in the "enter initial replacement" step. */
export const INITIAL_NOTE = "__initial__";
export const setTz = (z: string) => { TZ = z; };
export const getTz = () => TZ;

export function today(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: TZ });
}

const DAY = 86400000;
const toMs = (d: string) => Date.parse(d + "T00:00:00Z");
const fromMs = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export function daysBetween(a: string, b: string): number {
  return Math.round((toMs(b) - toMs(a)) / DAY);
}

export function addDays(d: string, n: number): string {
  return fromMs(toMs(d) + n * DAY);
}

export function addMonths(d: string, n: number): string {
  const [y, m, day] = d.split("-").map(Number);
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  const last = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
  return `${ny}-${String(nm).padStart(2, "0")}-${String(Math.min(day, last)).padStart(2, "0")}`;
}

export function normName(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
