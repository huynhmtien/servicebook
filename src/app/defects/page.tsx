import Link from "next/link";
import { listDefects, listVehicles } from "../../lib/queries.ts";
import { getI18n } from "../../lib/settings.ts";
import Icon from "../components/Icon";
import { Flash } from "../components/ui";

const SEV_ICON = { high: "alert", medium: "clock", low: "check" } as const;

export default async function Defects({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { ok, error } = await searchParams;
  const { t, fmt } = await getI18n();
  const vehicles = await listVehicles();
  const all = await listDefects();
  const open = all.filter((d) => d.status === "open");
  const done = all.filter((d) => d.status === "resolved");
  const row = (d: (typeof all)[number]) => (
    <Link key={d.id} href={`/defects/${d.id}`} className={`li${d.status === "resolved" ? " resolved" : ""}`}>
      <span className={`dotsev ${d.severity}`}><Icon n={d.status === "resolved" ? "check" : SEV_ICON[d.severity]} s={20} /></span>
      <div className="grow">
        <div className="t">{d.title}</div>
        <div className="mute">{vehicles.length > 1 ? `${d.vehicle} · ` : ""}{fmt.date(d.date)}{d.odo ? ` · ${fmt.dist(d.odo)}` : ""}</div>
      </div>
      {d.status === "open" && <span className={`sev ${d.severity}`}>{t(`defects.sev_${d.severity}` as const)}</span>}
    </Link>
  );
  return (
    <>
      <h1>{t("defects.title")}</h1>
      <p className="sub">{t("defects.sub")}</p>
      <Flash text={error} />
      <Flash text={ok} ok />
      {vehicles.length === 0 ? (
        <div className="card">{t("defects.no_vehicle")} <Link href="/vehicles">{t("rec.need_vehicle_link")}</Link></div>
      ) : (
        <div className="actions" style={{ marginBottom: 16 }}>
          <Link href="/defects/new" className="btn primary"><Icon n="camera" s={22} />{t("defects.new")}</Link>
          {open.length > 0 && <Link href={`/defects/report?vehicle=${vehicles[0].id}`} className="btn ghost"><Icon n="printer" s={20} />{t("defects.report_btn")}</Link>}
        </div>
      )}
      {all.length === 0 && vehicles.length > 0 && <div className="card mute">{t("defects.empty")}</div>}
      {open.length > 0 && (<><div className="sec"><h2>{t("defects.open_title", { n: open.length })}</h2></div><div className="list">{open.map(row)}</div></>)}
      {done.length > 0 && (<><div className="sec"><h2>{t("defects.resolved_title")}</h2></div><div className="list">{done.map(row)}</div></>)}
    </>
  );
}
