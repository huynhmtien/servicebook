import type { Status } from "./rules.ts";

/** Minimal shape needed from a tracked rule (RuleRow satisfies it). */
export interface HealthRule {
  enabled: boolean; status: Status; intervalKm: number | null; intervalMonths: number | null;
  kmLeft: number | null; daysLeft: number | null;
}
export type Severity = "low" | "medium" | "high";
export type HealthLevel = "good" | "watch" | "bad";

export interface Health {
  /** 0–100 */
  score: number;
  level: HealthLevel;
  overdue: number; soon: number; ok: number; unknown: number; openDefects: number;
}

const DEFECT_PENALTY: Record<Severity, number> = { low: 3, medium: 8, high: 15 };

/**
 * One number for "how healthy is this car": starts at 100; each overdue item costs 12 (max 60), each due-soon item 4 (max 20),
 * open defects cost by severity (max 30). Items with no data are not penalised — they only lower the coverage shown elsewhere.
 */
export function computeHealth(rules: HealthRule[], openDefects: Severity[] = []): Health {
  const on = rules.filter((r) => r.enabled);
  const overdue = on.filter((r) => r.status === "overdue").length;
  const soon = on.filter((r) => r.status === "soon").length;
  const ok = on.filter((r) => r.status === "ok").length;
  const unknown = on.filter((r) => r.status === "unknown").length;
  const penalty = Math.min(60, overdue * 12) + Math.min(20, soon * 4) + Math.min(30, openDefects.reduce((a, s) => a + (DEFECT_PENALTY[s] ?? 8), 0));
  const score = Math.max(0, 100 - penalty);
  const level: HealthLevel = score >= 85 ? "good" : score >= 60 ? "watch" : "bad";
  return { score, level, overdue, soon, ok, unknown, openDefects: openDefects.length };
}

/** How much of the interval is used up, 0..1+ (the larger of the km and time fractions); null if unknown. */
export function usedFraction(r: HealthRule): number | null {
  const f: number[] = [];
  if (r.kmLeft != null && r.intervalKm) f.push(1 - r.kmLeft / r.intervalKm);
  if (r.daysLeft != null && r.intervalMonths) f.push(1 - r.daysLeft / (r.intervalMonths * 30.4));
  return f.length ? Math.max(0, Math.max(...f)) : null;
}
