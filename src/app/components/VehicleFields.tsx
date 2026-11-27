import type { T } from "../../lib/i18n/index.ts";
import type { VehicleScan } from "../../lib/vehicle-ai.ts";

export interface VehicleValues {
  name?: string; plate?: string | null; model?: string | null; year?: number | string | null; odo?: number | string | null;
  fuel?: string | null; transmission?: string | null; engine?: string | null; vin?: string | null;
}

/** Parse the `?reg=` JSON that scanRegistration puts in the URL into form defaults (nothing is saved until the user submits). */
export function fromRegParam(raw: string | undefined): (VehicleValues & { filled: true }) | null {
  if (!raw) return null;
  try {
    const r = JSON.parse(raw) as Partial<VehicleScan>;
    const model = [r.make, r.model].filter(Boolean).join(" ") || null;
    return { filled: true, name: r.model ?? r.make ?? undefined, plate: r.plate, model, year: r.year, fuel: r.fuel, transmission: r.transmission, engine: r.engine, vin: r.vin };
  } catch { return null; }
}

/** The vehicle form fields shared by "add vehicle" and "edit vehicle". `p` prefixes the element ids so both can be on one page. */
export default function VehicleFields({ p, v, t, unit, withOdo = true }: { p: string; v: VehicleValues; t: T; unit: string; withOdo?: boolean }) {
  return (
    <>
      <div className="field wide"><label htmlFor={`${p}name`}>{t("veh.name")}</label><input id={`${p}name`} name="name" required defaultValue={v.name ?? ""} placeholder={t("veh.name_ph")} /></div>
      <div className="field wide"><label htmlFor={`${p}model`}>{t("veh.model")}</label><input id={`${p}model`} name="model" defaultValue={v.model ?? ""} placeholder={t("veh.model_ph")} /></div>
      <div className="field"><label htmlFor={`${p}plate`}>{t("veh.plate")}</label><input id={`${p}plate`} name="plate" defaultValue={v.plate ?? ""} autoCapitalize="characters" /></div>
      <div className="field"><label htmlFor={`${p}year`}>{t("veh.year")}</label><input id={`${p}year`} name="year" inputMode="numeric" defaultValue={v.year ?? ""} /></div>
      <div className="field"><label htmlFor={`${p}fuel`}>{t("veh.fuel")}</label>
        <select id={`${p}fuel`} name="fuel" defaultValue={v.fuel ?? ""}>
          <option value="">{t("common.dash")}</option>
          <option value="diesel">{t("veh.fuel_diesel")}</option><option value="petrol">{t("veh.fuel_petrol")}</option>
          <option value="hybrid">{t("veh.fuel_hybrid")}</option><option value="electric">{t("veh.fuel_electric")}</option>
        </select></div>
      <div className="field"><label htmlFor={`${p}transmission`}>{t("veh.transmission")}</label>
        <select id={`${p}transmission`} name="transmission" defaultValue={v.transmission ?? ""}>
          <option value="">{t("common.dash")}</option>
          <option value="manual">{t("veh.trans_manual")}</option><option value="automatic">{t("veh.trans_automatic")}</option>
          <option value="cvt">{t("veh.trans_cvt")}</option><option value="dct">{t("veh.trans_dct")}</option>
        </select></div>
      <div className="field"><label htmlFor={`${p}engine`}>{t("veh.engine")}</label><input id={`${p}engine`} name="engine" defaultValue={v.engine ?? ""} placeholder={t("veh.engine_ph")} /></div>
      {withOdo && <div className="field"><label htmlFor={`${p}odo`}>{t("veh.odo", { unit })}</label><input id={`${p}odo`} name="odo" inputMode="numeric" required defaultValue={v.odo ?? ""} /></div>}
      <div className="field wide"><label htmlFor={`${p}vin`}>{t("veh.vin")}</label><input id={`${p}vin`} name="vin" defaultValue={v.vin ?? ""} autoCapitalize="characters" /></div>
      <p className="mute">{t("veh.spec_hint")}</p>
    </>
  );
}
