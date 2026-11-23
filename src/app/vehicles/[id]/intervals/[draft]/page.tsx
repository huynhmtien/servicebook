import Link from "next/link";
import { notFound } from "next/navigation";
import { all, get } from "../../../../../lib/db.ts";
import type { IntervalProposal } from "../../../../../lib/intervals.ts";
import { getI18n } from "../../../../../lib/settings.ts";
import { partLabel } from "../../../../../lib/parts.ts";
import { applyIntervals } from "../../../../actions";
import { Flash } from "../../../../components/ui";

const CONF = { high: { c: "b-ok", k: "iv.conf_high" }, medium: { c: "b-soon", k: "iv.conf_medium" }, low: { c: "b-overdue", k: "iv.conf_low" } } as const;

export default async function IntervalReview({ params }: { params: Promise<{ id: string; draft: string }> }) {
  const { id, draft } = await params;
  const { t, fmt, lang } = await getI18n();
  const vid = Number(id);
  const row = await get<{ data: string }>("SELECT data FROM drafts WHERE id = ? AND vehicle_id = ?", Number(draft), vid);
  if (!row) notFound();
  const p = JSON.parse(row.data) as IntervalProposal;
  if (p.kind !== "intervals") notFound();
  const names = new Map((await all<{ id: number; key: string | null; name: string }>("SELECT id, key, name FROM part_types")).map((x) => [x.id, partLabel(x, lang)]));
  const cur = new Map((await all<{ part_type_id: number; interval_km: number | null; interval_months: number | null; source: string }>(
    "SELECT part_type_id, interval_km, interval_months, source FROM rules WHERE vehicle_id = ?", vid)).map((x) => [x.part_type_id, x]));
  return (
    <>
      <p className="sub"><Link href={`/vehicles/${vid}#intervals`}>{t("iv.back")}</Link></p>
      <h1>{t("iv.title")}</h1>
      <p className="sub">{p.origin === "doc" ? t("iv.from_doc") : p.vehicle_desc ? t("iv.from_ai_for", { desc: p.vehicle_desc }) : `${t("iv.from_ai")}.`}{t("iv.only_checked")}</p>
      <Flash text={t("iv.warning")} />
      {p.caveats && <div className="card"><b>{t("iv.caveats")}</b><div className="mute" style={{ marginTop: 4 }}>{p.caveats}</div></div>}
      {p.sources.length > 0 && (
        <div className="card"><b>{t("iv.sources")}</b>
          <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>{p.sources.slice(0, 8).map((s) => <li key={s.url}><a href={s.url} target="_blank" rel="noreferrer">{s.title}</a></li>)}</ul></div>
      )}

      <form action={applyIntervals}>
        <input type="hidden" name="vehicle_id" value={vid} />
        <input type="hidden" name="draft_id" value={draft} />
        {p.items.map((it) => {
          const c = cur.get(it.part_type_id);
          const conf = CONF[it.confidence];
          const curText = c
            ? t("iv.current_fmt", { km: c.interval_km != null ? fmt.num(c.interval_km) : "—", unit: fmt.unit, months: c.interval_months != null ? c.interval_months : "—" })
            : "—";
          return (
            <div className="item" key={it.part_type_id} style={{ gridTemplateColumns: "1fr 1fr" }}>
              <div className="full row" style={{ justifyContent: "space-between", flexWrap: "nowrap" }}>
                <label style={{ margin: 0, display: "flex", gap: 10, alignItems: "center", color: "var(--text)", fontSize: 17 }}>
                  <input type="checkbox" name={`apply_${it.part_type_id}`} defaultChecked={it.confidence !== "low"} />
                  <b>{names.get(it.part_type_id)}</b>
                </label>
                <span className={`badge ${conf.c}`}>{t(conf.k)}</span>
              </div>
              <div className="full mute">{t("iv.current", { value: curText })}</div>
              <div><label htmlFor={`km_${it.part_type_id}`}>{t("iv.interval_km", { unit: fmt.unit })}</label><input id={`km_${it.part_type_id}`} name={`km_${it.part_type_id}`} inputMode="numeric" defaultValue={it.interval_km ?? ""} /></div>
              <div><label htmlFor={`mo_${it.part_type_id}`}>{t("iv.interval_mo")}</label><input id={`mo_${it.part_type_id}`} name={`mo_${it.part_type_id}`} inputMode="numeric" defaultValue={it.interval_months ?? ""} /></div>
              {(it.note || it.source_url) && (
                <div className="full mute">{it.note}{it.source_url && <> {" "}<a href={it.source_url} target="_blank" rel="noreferrer">{t("iv.see_source")}</a></>}</div>
              )}
            </div>
          );
        })}
        <button className="btn primary block" type="submit">{t("iv.apply")}</button>
      </form>
    </>
  );
}
