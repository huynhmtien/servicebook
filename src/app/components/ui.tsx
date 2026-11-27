import type { RuleRow } from "../../lib/queries.ts";
import type { Status } from "../../lib/rules.ts";
import type { T } from "../../lib/i18n/index.ts";
import type { Fmt } from "../../lib/format.ts";
import Icon from "./Icon";
import { usedFraction } from "../../lib/health.ts";

const ICON: Record<Status, string> = { overdue: "alert", soon: "clock", ok: "check", unknown: "help" };
export const Badge = ({ s, t }: { s: Status; t: T }) => (
  <span className={`badge b-${s}`}><Icon n={ICON[s]} s={14} />{t(`status.${s}` as const)}</span>
);

export function describe(r: RuleRow, t: T, fmt: Fmt): string {
  const out: string[] = [];
  if (r.kmLeft != null) out.push(r.kmLeft <= 0 ? t("describe.km_over", { n: fmt.num(-r.kmLeft), unit: fmt.unit }) : t("describe.km_left", { n: fmt.num(r.kmLeft), unit: fmt.unit }));
  if (r.daysLeft != null) out.push(r.daysLeft <= 0 ? t("describe.days_over", { count: -r.daysLeft }) : t("describe.days_left", { count: r.daysLeft }));
  return out.join(" · ") || "—";
}

export function AlertItem({ r, vehicle, t, fmt, partName }: { r: RuleRow; vehicle?: string; t: T; fmt: Fmt; partName: string }) {
  return (
    <div className={`alert ${r.status}`}>
      <span className="dot"><Icon n={r.status === "overdue" ? "alert" : "clock"} s={20} /></span>
      <div className="body">
        <div className="row" style={{ gap: 8, justifyContent: "space-between", flexWrap: "wrap" }}>
          <b>{partName}</b><Badge s={r.status} t={t} />
        </div>
        <div style={{ fontWeight: 600 }}>
          {describe(r, t, fmt)}
          {r.status === "soon" && r.predictedDate ? ` · ${t("alert.expected", { date: fmt.date(r.predictedDate) })}` : ""}
        </div>
        <Progress r={r} t={t} />
        <div className="mute" style={{ marginTop: 6 }}>
          {vehicle ? `${vehicle} · ` : ""}{r.last ? (r.last.odo != null ? t("alert.last_changed_odo", { date: fmt.date(r.last.date), odo: fmt.dist(r.last.odo) }) : t("alert.last_changed", { date: fmt.date(r.last.date) })) : ""}
        </div>
      </div>
    </div>
  );
}

export function Flash({ text, ok }: { text?: string; ok?: boolean }) {
  return text ? <div className={`flash${ok ? " ok" : ""}`} role={ok ? "status" : "alert"}>{text}</div> : null;
}

/** How much of the interval is used up (capped at 100%); colour follows the status, the % is also written for screen readers. */
export function Progress({ r, t }: { r: RuleRow; t: T }) {
  const f = usedFraction(r);
  if (f == null) return null;
  const pct = Math.round(Math.min(1, f) * 100);
  return <div className={`prog ${r.status}`} role="img" aria-label={t("dash.used", { pct })}><i style={{ width: `${Math.max(pct, 3)}%` }} /></div>;
}

export function Ring({ score, aria }: { score: number; aria: string }) {
  const C = 2 * Math.PI * 46; // 289
  return (
    <div className="ring" role="img" aria-label={aria}>
      <svg viewBox="0 0 112 112" aria-hidden="true">
        <circle className="trk" cx="56" cy="56" r="46" strokeWidth="10" />
        <circle className="val" cx="56" cy="56" r="46" strokeWidth="10" strokeDasharray={C} strokeDashoffset={C * (1 - score / 100)} />
      </svg>
      <div className="num"><b>{score}</b><small>/100</small></div>
    </div>
  );
}
