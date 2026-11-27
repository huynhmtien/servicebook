import Link from "next/link";
import { listVehicles } from "../../lib/queries.ts";
import { getI18n } from "../../lib/settings.ts";
import { addVehicle, scanRegistration } from "../actions";
import { Flash } from "../components/ui";
import Icon from "../components/Icon";
import DocUpload from "../components/DocUpload";
import VehicleFields, { fromRegParam } from "../components/VehicleFields";
import { scanEnabled } from "../../lib/extract.ts";

export const maxDuration = 60;

export default async function Vehicles({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string; reg?: string }> }) {
  const { ok, error, reg } = await searchParams;
  const pre = fromRegParam(reg);
  const { t, fmt } = await getI18n();
  const vs = await listVehicles();
  return (
    <>
      <h1>{t("veh.title")}</h1>
      <Flash text={error} />
      <Flash text={ok} ok />
      {vs.length > 0 && (
        <div className="list">
          {vs.map((v) => (
            <Link key={v.id} href={`/vehicles/${v.id}`} className="li">
              <div className="grow"><div className="t">{v.name}</div><div className="mute">{[v.plate, v.model, v.year].filter(Boolean).join(" · ")}</div></div>
              <div className="r t">{fmt.dist(v.odo)}</div>
            </Link>
          ))}
        </div>
      )}
      <h2 id="add">{t("veh.add_title")}</h2>
      {scanEnabled() && (
        <div className="card">
          <div className="row" style={{ gap: 10, marginBottom: 6 }}><span className="tile" style={{ minHeight: 0, padding: 0, boxShadow: "none", background: "none" }}><span className="ic"><Icon n="card" s={22} /></span></span><b>{t("veh.reg_title")}</b></div>
          <p className="mute" style={{ margin: "0 0 12px" }}>{t("veh.reg_hint")}</p>
          <DocUpload vehicleId={0} action={scanRegistration} label={t("veh.reg_btn")} busy={t("veh.reg_busy")} />
        </div>
      )}
      {pre && <Flash text={t("veh.reg_filled")} ok />}
      <form action={addVehicle} className="card form cols2" key={reg ?? "new"}>
        <VehicleFields p="" v={pre ?? {}} t={t} unit={fmt.unit} />
        <button className="btn primary" type="submit">{t("veh.submit")}</button>
      </form>
      <p><Link href="/settings" className="btn ghost block">{t("veh.settings_link")}</Link></p>
    </>
  );
}
