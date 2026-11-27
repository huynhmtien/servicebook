import Link from "next/link";
import { notFound } from "next/navigation";
import { getVehicle, vehicleRules, vehicleAvgKmPerDay } from "../../../lib/queries.ts";
import { getI18n } from "../../../lib/settings.ts";
import { partLabel, categoryRank } from "../../../lib/parts.ts";
import type { T } from "../../../lib/i18n/index.ts";
import { Badge, describe, Flash } from "../../components/ui";
import ConfirmButton from "../../components/ConfirmButton";
import { deleteVehicle, researchIntervalsAction, saveRules, scanIntervalDoc, scanRegistration, updateOdo, updateVehicle } from "../../actions";
import VehicleFields, { fromRegParam } from "../../components/VehicleFields";
import Icon from "../../components/Icon";
import { specDesc } from "../../../lib/vehicle-spec.ts";
import { scanEnabled } from "../../../lib/extract.ts";
import DocUpload from "../../components/DocUpload";
import { researchProviders } from "../../../lib/intervals.ts";

export const maxDuration = 60;

function SourceTag({ r, t }: { r: { source: string; sourceUrl: string | null; sourceNote: string | null }; t: T }) {
  // generic defaults are explained once in the "Where do the intervals come from?" card; only verified/chosen sources get a badge
  if (r.source === "default") return null;
  const tag = r.source === "doc" ? { c: "b-ok", l: t("src.doc") } : r.source === "user" ? { c: "b-ok", l: t("src.user") } : { c: "b-info", l: t("src.ai") };
  return (
    <span className="row" style={{ gap: 6 }}>
      <span className={`badge ${tag.c}`}>{tag.l}</span>
      {r.sourceUrl && <a href={r.sourceUrl} target="_blank" rel="noreferrer" style={{ fontSize: 13 }}>{t("src.link")}</a>}
    </span>
  );
}

export default async function VehiclePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string; reg?: string }> }) {
  const id = Number((await params).id);
  const { ok, error, reg } = await searchParams;
  const pre = fromRegParam(reg);
  const { t, fmt, lang } = await getI18n();
  const v = await getVehicle(id);
  if (!v) notFound();
  const order = { overdue: 0, soon: 1, ok: 2, unknown: 3 } as const;
  const all = (await vehicleRules(id)).sort((a, b) => order[a.status] - order[b.status] || a.urgency - b.urgency || categoryRank(a.category) - categoryRank(b.category));
  const rules = [...all.filter((r) => r.intervalKm != null || r.intervalMonths != null), ...all.filter((r) => r.intervalKm == null && r.intervalMonths == null)];
  const canSearch = researchProviders().length > 0;
  const avg = await vehicleAvgKmPerDay(id);
  const desc = specDesc(v) || t("veh.research_desc_fallback");
  const renderRule = (r: (typeof rules)[number]) => {
            const name = partLabel({ key: r.partKey, name: r.partName }, lang);
            const ivText = [r.intervalKm != null ? fmt.dist(r.intervalKm) : null, r.intervalMonths != null ? t("veh.interval_months", { n: r.intervalMonths }) : null].filter(Boolean).join(t("veh.interval_or")) || t("veh.interval_none");
            return (
              <div className="rule" key={r.ruleId}>
                <input type="checkbox" name={`on_${r.ruleId}`} defaultChecked={r.enabled} aria-label={t("veh.track_aria", { part: name })} />
                <div><div style={{ fontWeight: 600 }}>{name}</div>
                  <div className="mute">{r.last ? `${r.last.odo != null ? t("veh.last_replaced_odo", { date: fmt.date(r.last.date), odo: fmt.dist(r.last.odo) }) : t("veh.last_replaced", { date: fmt.date(r.last.date) })}${r.last.garage ? t("veh.last_replaced_garage", { garage: r.last.garage }) : ""}` : t("veh.no_replacement")}
                    {r.status !== "unknown" && ` · ${describe(r, t, fmt)}`}</div>
                  {r.source !== "default" && (r.intervalKm != null || r.intervalMonths != null) && <div style={{ marginTop: 4 }}><SourceTag r={r} t={t} /></div>}</div>
                {r.intervalKm == null && r.intervalMonths == null ? <span className="badge b-unknown">{t("veh.no_interval")}</span> : <Badge s={r.status} t={t} />}
                <details className="iv-box">
                  <summary className="mute">{t("veh.interval_summary", { value: ivText })}</summary>
                  {r.sourceNote && <div className="mute" style={{ margin: "6px 0 2px" }}>{r.sourceNote}</div>}
                  <div className="iv">
                    <span className="mute">{t("veh.every")}</span>
                    <input name={`km_${r.ruleId}`} defaultValue={r.intervalKm ?? ""} inputMode="numeric" aria-label={t("veh.km_aria", { unit: fmt.unit, part: name })} placeholder={t("veh.km_ph", { unit: fmt.unit })} /> <span className="mute">{t("veh.km_or", { unit: fmt.unit })}</span>
                    <input name={`mo_${r.ruleId}`} defaultValue={r.intervalMonths ?? ""} inputMode="numeric" aria-label={t("veh.mo_aria", { part: name })} placeholder={t("veh.mo_ph")} /> <span className="mute">{t("veh.months_first")}</span>
                  </div>
                </details>
              </div>
            );
  };
  const tracked = rules.filter((r) => r.status !== "unknown" || r.source !== "default");
  const untracked = rules.filter((r) => !tracked.includes(r));
  return (
    <>
      <p className="sub"><Link href="/vehicles" className="back">{t("veh.back")}</Link></p>
      <h1>{v.name}</h1>
      <p className="sub">{[v.plate, v.model, v.year, v.engine].filter(Boolean).join(" · ")}</p>
      <Flash text={error} />
      <Flash text={ok} ok />
      <div className="card">
        <div className="mute">{t("veh.current_odo")}</div><div className="stat">{fmt.dist(v.odo)}</div>
        <div className="mute">{t("veh.avg_per_day", { n: fmt.num(avg), unit: fmt.unit })}</div>
        <form action={updateOdo} className="row" style={{ marginTop: 12, flexWrap: "nowrap" }}>
          <input type="hidden" name="vehicle_id" value={id} />
          <input type="hidden" name="back" value={`/vehicles/${id}`} />
          <input name="km" inputMode="numeric" placeholder={t("veh.odo_new")} aria-label={t("veh.odo_new")} style={{ flex: 1, minWidth: 0 }} required /><button>{t("common.update")}</button>
        </form>
      </div>

      <details className="card" id="edit" open={!!pre}>
        <summary>{t("veh.edit")}</summary>
        {scanEnabled() && (
          <div style={{ margin: "12px 0 4px", paddingBottom: 14, borderBottom: ".5px solid var(--line)" }}>
            <div className="row" style={{ gap: 8, marginBottom: 4 }}><Icon n="card" s={20} /><b>{t("veh.reg_title")}</b></div>
            <p className="mute" style={{ margin: "0 0 10px" }}>{t("veh.reg_hint")}</p>
            <DocUpload vehicleId={id} action={scanRegistration} label={t("veh.reg_btn")} busy={t("veh.reg_busy")} />
          </div>
        )}
        {pre && <div style={{ marginTop: 12 }}><Flash text={t("veh.reg_filled")} ok /></div>}
        <form action={updateVehicle} className="form cols2" style={{ marginTop: 12 }} key={reg ?? "cur"}>
          <input type="hidden" name="id" value={id} />
          <VehicleFields p="e_" v={pre ? { ...pre, odo: v.odo, name: v.name } : v} t={t} unit={fmt.unit} />
          <button className="btn primary" type="submit">{t("veh.edit_save")}</button>
        </form>
      </details>

      <div className="card" id="intervals">
        <b>{t("veh.intervals_title")}</b>
        <p className="mute" style={{ margin: "6px 0 12px" }}>{t("veh.intervals_body")}</p>
        <form action={researchIntervalsAction} style={{ marginBottom: 12 }}>
          <input type="hidden" name="vehicle_id" value={id} />
          <button className="btn primary block" type="submit" disabled={!canSearch}>{t("veh.research_btn", { desc })}</button>
          <div className="mute" style={{ marginTop: 6 }}>{canSearch ? t("veh.research_hint") : t("veh.research_nokey")}</div>
          {(!v.transmission || !v.fuel) && <div className="flash" style={{ marginTop: 10, marginBottom: 0 }}>{t("veh.spec_missing")} <a href="#edit">{t("veh.edit")}</a></div>}
        </form>
        <div style={{ borderTop: ".5px solid var(--line)", paddingTop: 12 }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>{t("veh.doc_title")}</div>
          <DocUpload vehicleId={id} action={scanIntervalDoc} label={t("veh.doc_btn")} busy={t("veh.doc_busy")} />
        </div>
      </div>

      <div className="row" style={{ justifyContent: "space-between" }}>
        <h2 style={{ margin: "16px 0 8px" }}>{t("veh.parts_title")}</h2>
        <Link href={`/vehicles/${id}/setup`} className="btn ghost">{t("veh.initial_link")}</Link>
      </div>
      <form action={saveRules}>
        <input type="hidden" name="vehicle_id" value={id} />
        <div className="list">
          {tracked.map(renderRule)}
        </div>
        {untracked.length > 0 && (
          <details className="card">
            <summary>{t("veh.show_untracked", { n: untracked.length })}</summary>
            <div className="list" style={{ margin: "12px 0 0", boxShadow: "none" }}>{untracked.map(renderRule)}</div>
          </details>
        )}
        <button className="btn primary block">{t("veh.save_intervals")}</button>
      </form>

      <form action={deleteVehicle} style={{ marginTop: 28 }}>
        <input type="hidden" name="id" value={id} />
        <ConfirmButton label={t("veh.delete_btn")} message={t("veh.delete_confirm")} />
      </form>
    </>
  );
}
