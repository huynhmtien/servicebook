import Link from "next/link";
import { notFound } from "next/navigation";
import { getVehicle, openDefectsWithThumb, listVehicles } from "../../../lib/queries.ts";
import { getI18n } from "../../../lib/settings.ts";
import { fullModel } from "../../../lib/vehicle-spec.ts";
import PrintButton from "../../components/PrintButton";

export default async function Report({ searchParams }: { searchParams: Promise<{ vehicle?: string }> }) {
  const { vehicle } = await searchParams;
  const { t, fmt } = await getI18n();
  const vs = await listVehicles();
  const v = await getVehicle(Number(vehicle) || vs[0]?.id || 0);
  if (!v) notFound();
  const list = await openDefectsWithThumb(v.id);
  return (
    <div className="report">
      <p className="noprint sub"><Link href="/defects" className="back">{t("defects.back")}</Link></p>
      <h1>{t("defects.report_title", { vehicle: fullModel(v) })}</h1>
      <p className="mute">{[v.plate, v.year, v.engine, `${fmt.dist(v.odo)}`, fmt.date(new Date().toISOString().slice(0, 10))].filter(Boolean).join(" · ")}</p>
      <div className="noprint" style={{ margin: "12px 0 18px" }}><PrintButton label={t("defects.print")} /></div>
      {vs.length > 1 && (
        <div className="noprint row" style={{ marginBottom: 14 }}>
          {vs.map((x) => <Link key={x.id} href={`/defects/report?vehicle=${x.id}`} className={`btn ${x.id === v.id ? "primary" : "ghost"}`}>{x.name}</Link>)}
        </div>
      )}
      {list.length === 0 && <div className="card mute">{t("defects.report_none")}</div>}
      {list.map((d, i) => (
        <article className="defect" key={d.id}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <b style={{ fontSize: 17 }}>{i + 1}. {d.title}</b>
            <span className={`sev ${d.severity}`}>{t(`defects.sev_${d.severity}` as const)}</span>
          </div>
          <div className="mute">{t("defects.at", { date: fmt.date(d.date), odo: d.odo ? fmt.dist(d.odo) : "—" })}</div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {d.thumb && <img className="photo" src={d.thumb} alt={d.title} style={{ margin: "10px 0", maxHeight: 260 }} />}
          {d.description && <p style={{ margin: "8px 0" }}>{d.description}</p>}
          <dl className="kv">
            {d.area && <><dt>{t("defects.area")}</dt><dd>{d.area}</dd></>}
            {d.advice && <><dt>{t("defects.advice")}</dt><dd>{d.advice}</dd></>}
            {d.user_note && <><dt>{t("defects.your_note")}</dt><dd>{d.user_note}</dd></>}
          </dl>
        </article>
      ))}
    </div>
  );
}
