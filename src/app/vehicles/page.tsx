import Link from "next/link";
import { listVehicles } from "../../lib/queries.ts";
import { getI18n } from "../../lib/settings.ts";
import { addVehicle } from "../actions";
import { Flash } from "../components/ui";

export default async function Vehicles({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  const { ok } = await searchParams;
  const { t, fmt } = await getI18n();
  const vs = await listVehicles();
  return (
    <>
      <h1>{t("veh.title")}</h1>
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
      <h2>{t("veh.add_title")}</h2>
      <form action={addVehicle} className="card form">
        <div className="field"><label htmlFor="name">{t("veh.name")}</label><input id="name" name="name" required placeholder={t("veh.name_ph")} /></div>
        <div className="field"><label htmlFor="plate">{t("veh.plate")}</label><input id="plate" name="plate" /></div>
        <div className="field"><label htmlFor="model">{t("veh.model")}</label><input id="model" name="model" placeholder={t("veh.model_ph")} /></div>
        <div className="field"><label htmlFor="year">{t("veh.year")}</label><input id="year" name="year" inputMode="numeric" /></div>
        <div className="field"><label htmlFor="odo">{t("veh.odo", { unit: fmt.unit })}</label><input id="odo" name="odo" inputMode="numeric" required /></div>
        <div className="field"><label htmlFor="fuel">{t("veh.fuel")}</label>
          <select id="fuel" name="fuel" defaultValue="">
            <option value="">{t("common.dash")}</option>
            <option value="diesel">{t("veh.fuel_diesel")}</option><option value="petrol">{t("veh.fuel_petrol")}</option>
            <option value="hybrid">{t("veh.fuel_hybrid")}</option><option value="electric">{t("veh.fuel_electric")}</option>
          </select></div>
        <button className="btn primary" type="submit">{t("veh.submit")}</button>
      </form>
      <p><Link href="/settings">{t("veh.settings_link")}</Link></p>
    </>
  );
}
