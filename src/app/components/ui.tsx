import type { RuleRow } from "../../lib/queries.ts";
import type { Status } from "../../lib/rules.ts";
import type { T } from "../../lib/i18n/index.ts";
import type { Fmt } from "../../lib/format.ts";
import Icon from "./Icon";

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
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="row" style={{ gap: 8, justifyContent: "space-between", flexWrap: "wrap" }}>
          <b>{partName}</b><Badge s={r.status} t={t} />
        </div>
        <div style={{ fontWeight: 600 }}>
          {describe(r, t, fmt)}
          {r.status === "soon" && r.predictedDate ? ` · ${t("alert.expected", { date: fmt.date(r.predictedDate) })}` : ""}
        </div>
        <div className="mute">
          {vehicle ? `${vehicle} · ` : ""}{r.last ? (r.last.odo != null ? t("alert.last_changed_odo", { date: fmt.date(r.last.date), odo: fmt.dist(r.last.odo) }) : t("alert.last_changed", { date: fmt.date(r.last.date) })) : ""}
        </div>
      </div>
    </div>
  );
}

export function Flash({ text, ok }: { text?: string; ok?: boolean }) {
  return text ? <div className={`flash${ok ? " ok" : ""}`} role="status">{text}</div> : null;
}
