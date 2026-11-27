import { normName } from "./util.ts";

// Small, dictionary-free part helpers shared with client components (the big catalog with keywords stays in parts.ts, server only).
/** Part categories (stable key, stored in the DB; display name in i18n: `cat.<key>`). */
export const CATEGORIES = ["periodic", "engine", "cooling", "ac", "drivetrain", "brakes", "chassis", "electrical", "documents", "other_costs"] as const;
export type Category = (typeof CATEGORIES)[number];

/** Categories without due tracking (only for cost classification). */
export const COST_ONLY: Category = "other_costs";
/** Keys of two special entries: general labor and "uncategorized". */
export const LABOR_KEY = "labor";
export const GENERIC_KEY = "other";

/** Guess the part from an item name (longest keyword match). Returns an id or null. */
export function guessPart(raw: string, parts: { id: number; kw: string[] }[]): number | null {
  const n = ` ${normName(raw)} `;
  let best: { id: number; len: number } | null = null;
  for (const p of parts)
    for (const k of p.kw) {
      if (k && n.includes(` ${k} `) && (!best || k.length > best.len)) best = { id: p.id, len: k.length };
    }
  return best?.id ?? null;
}
