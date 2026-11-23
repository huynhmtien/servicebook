import { addDays, addMonths, daysBetween } from "./util.ts";

export type Status = "overdue" | "soon" | "ok" | "unknown";

export interface RuleInput {
  intervalKm: number | null;
  intervalMonths: number | null;
  last: { date: string; odo: number | null } | null;
  vehicleOdo: number;
  today: string;
  avgKmPerDay: number;
}

export interface RuleResult {
  status: Status;
  dueKm: number | null;
  dueDate: string | null;
  kmLeft: number | null;
  daysLeft: number | null;
  /** Ngày dự kiến tới hạn sớm nhất (theo thời gian hoặc theo km ước tính) */
  predictedDate: string | null;
  /** Mức độ gấp, càng nhỏ càng gấp; dùng để sắp xếp */
  urgency: number;
  trigger: "km" | "time" | null;
}

export const WARN_DAYS = 30;
export const WARN_KM_MIN = 500;
export const WARN_KM_PCT = 0.15;

export function evaluateRule(i: RuleInput): RuleResult {
  const empty: RuleResult = {
    status: "unknown", dueKm: null, dueDate: null, kmLeft: null,
    daysLeft: null, predictedDate: null, urgency: 1e9, trigger: null,
  };
  if (!i.last || (i.intervalKm == null && i.intervalMonths == null)) return empty;

  let dueKm: number | null = null;
  let kmLeft: number | null = null;
  if (i.intervalKm != null && i.last.odo != null) {
    dueKm = i.last.odo + i.intervalKm;
    kmLeft = dueKm - i.vehicleOdo;
  }
  let dueDate: string | null = null;
  let daysLeft: number | null = null;
  if (i.intervalMonths != null) {
    dueDate = addMonths(i.last.date, i.intervalMonths);
    daysLeft = daysBetween(i.today, dueDate);
  }
  if (kmLeft == null && daysLeft == null) return empty;

  // quy km còn lại về số ngày để so sánh và sắp xếp chung một thước đo
  const kmDays = kmLeft != null && i.avgKmPerDay > 0 ? kmLeft / i.avgKmPerDay : null;
  const candidates: { days: number; t: "km" | "time" }[] = [];
  if (kmDays != null) candidates.push({ days: kmDays, t: "km" });
  if (daysLeft != null) candidates.push({ days: daysLeft, t: "time" });
  const first = candidates.reduce((a, b) => (b.days < a.days ? b : a));

  const kmThreshold = Math.max(WARN_KM_MIN, (i.intervalKm ?? 0) * WARN_KM_PCT);
  const overdue = (kmLeft != null && kmLeft <= 0) || (daysLeft != null && daysLeft <= 0);
  const soon =
    (kmLeft != null && kmLeft <= kmThreshold) || (daysLeft != null && daysLeft <= WARN_DAYS);

  const status: Status = overdue ? "overdue" : soon ? "soon" : "ok";
  const trigger =
    kmLeft != null && kmLeft <= 0 ? "km"
    : daysLeft != null && daysLeft <= 0 ? "time"
    : first.t;

  return {
    status, dueKm, dueDate, kmLeft, daysLeft,
    predictedDate: addDays(i.today, Math.floor(first.days)),
    urgency: first.days,
    trigger,
  };
}

export interface OdoPoint { date: string; km: number }

/** Km trung bình mỗi ngày từ lịch sử odo (tối đa ~1 năm gần nhất). */
export function avgKmPerDay(points: OdoPoint[], today: string, fallback = 40): number {
  const pts = points
    .filter((p) => daysBetween(p.date, today) <= 400)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.km - b.km));
  if (pts.length < 2) return fallback;
  const a = pts[0], b = pts[pts.length - 1];
  const days = daysBetween(a.date, b.date);
  if (days < 14 || b.km <= a.km) return fallback;
  return (b.km - a.km) / days;
}
