import { saveRecord } from "../actions";
import { listPartTypes, listVehicles } from "../../lib/queries.ts";
import { all } from "../../lib/db.ts";
import RecordItems from "./RecordItems";
import { getI18n } from "../../lib/settings.ts";
import { partLabel } from "../../lib/parts.ts";

export interface RecordDefaults {
  vehicle_id?: number; garage?: string; date?: string | null; odo?: number | null; note?: string;
  draft_id?: number; slip_total?: number | null;
  discount?: number; vat?: number; vat_rate?: number | null; vat_included?: boolean; vat_inferred?: boolean;
  items?: { raw_name: string; qty: number; amount: number; kind: string; part_type_id: number | null; how?: "memory" | "ai" | "keyword" | null; confidence?: number | null }[];
}

export default async function RecordForm({ d, blank = 3 }: { d: RecordDefaults; blank?: number }) {
  const { t, fmt, lang } = await getI18n();
  const vehicles = await listVehicles();
  const parts = await listPartTypes();
  const garages = await all<{ name: string }>("SELECT name FROM garages ORDER BY name");
  const items = d.items ?? [];
  return (
    <form action={saveRecord}>
      {d.draft_id && <input type="hidden" name="draft_id" value={d.draft_id} />}
      <div className="card form">
        <div className="field"><label htmlFor="vehicle_id">{t("form.vehicle")}</label>
          <select id="vehicle_id" name="vehicle_id" defaultValue={d.vehicle_id} required>
            {vehicles.map((v) => <option key={v.id} value={v.id}>{v.name}{v.plate ? ` — ${v.plate}` : ""}</option>)}
          </select></div>
        <div className="field"><label htmlFor="garage">{t("form.garage")}</label>
          <input id="garage" name="garage" list="garages" defaultValue={d.garage} placeholder={t("form.garage_ph")} />
          <datalist id="garages">{garages.map((g) => <option key={g.name} value={g.name} />)}</datalist></div>
        <div className="field"><label htmlFor="date">{t("form.date")}</label><input id="date" type="date" name="date" defaultValue={d.date ?? ""} required /></div>
        <div className="field"><label htmlFor="odo">{t("form.odo", { unit: fmt.unit })}</label><input id="odo" name="odo" inputMode="numeric" defaultValue={d.odo ?? ""} /></div>
      </div>

      <h2>{t("form.items")}</h2>
      <RecordItems parts={parts.map((p) => ({ id: p.id, name: partLabel(p, lang), category: p.category, kw: p.kw }))} initial={items} blank={blank}
        money={{ slipTotal: d.slip_total, discount: d.discount, vat: d.vat, vatRate: d.vat_rate, vatIncluded: d.vat_included, vatInferred: d.vat_inferred }} />
      <p className="mute">{t("form.assign_hint")}</p>
      <div className="field"><label htmlFor="note">{t("form.note")}</label><input id="note" name="note" defaultValue={d.note} /></div>
      <button className="btn primary block" type="submit" style={{ marginTop: 14 }}>{t("form.save")}</button>
    </form>
  );
}
