import type { RuleRow } from "../../lib/queries.ts";
import type { Status } from "../../lib/rules.ts";
import { fmtDate, num } from "../../lib/util.ts";
import Icon from "./Icon";

const LABEL: Record<Status, string> = { overdue: "Quá hạn", soon: "Sắp tới", ok: "Ổn", unknown: "Chưa có dữ liệu" };
const ICON: Record<Status, string> = { overdue: "alert", soon: "clock", ok: "check", unknown: "help" };
export const Badge = ({ s }: { s: Status }) => (
  <span className={`badge b-${s}`}><Icon n={ICON[s]} s={14} />{LABEL[s]}</span>
);

export function describe(r: RuleRow): string {
  const out: string[] = [];
  if (r.kmLeft != null) out.push(r.kmLeft <= 0 ? `quá ${num(-r.kmLeft)} km` : `còn ${num(r.kmLeft)} km`);
  if (r.daysLeft != null) out.push(r.daysLeft <= 0 ? `quá ${-r.daysLeft} ngày` : `còn ${r.daysLeft} ngày`);
  return out.join(" · ") || "—";
}

export function AlertItem({ r, vehicle }: { r: RuleRow; vehicle?: string }) {
  return (
    <div className={`alert ${r.status}`}>
      <span className="dot"><Icon n={r.status === "overdue" ? "alert" : "clock"} s={20} /></span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="row" style={{ gap: 8, justifyContent: "space-between", flexWrap: "wrap" }}>
          <b>{r.partName}</b><Badge s={r.status} />
        </div>
        <div style={{ fontWeight: 600 }}>
          {describe(r)}
          {r.status === "soon" && r.predictedDate ? ` · dự kiến ${fmtDate(r.predictedDate)}` : ""}
        </div>
        <div className="mute">
          {vehicle ? `${vehicle} · ` : ""}{r.last ? `thay lần cuối ${fmtDate(r.last.date)}${r.last.odo != null ? ` @ ${num(r.last.odo)} km` : ""}` : ""}
        </div>
      </div>
    </div>
  );
}

export function Flash({ text, ok }: { text?: string; ok?: boolean }) {
  return text ? <div className={`flash${ok ? " ok" : ""}`} role="status">{text}</div> : null;
}
