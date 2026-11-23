import { saveRecord } from "../actions";
import { listPartTypes, listVehicles } from "../../lib/queries.ts";
import { all } from "../../lib/db.ts";
import RecordItems from "./RecordItems";

export interface RecordDefaults {
  vehicle_id?: number; garage?: string; date?: string | null; odo?: number | null; note?: string;
  draft_id?: number; slip_total?: number | null;
  discount?: number; vat?: number; vat_rate?: number | null; vat_included?: boolean; vat_inferred?: boolean;
  items?: { raw_name: string; qty: number; amount: number; kind: string; part_type_id: number | null; how?: "memory" | "ai" | "keyword" | null; confidence?: number | null }[];
}

export default async function RecordForm({ d, blank = 3 }: { d: RecordDefaults; blank?: number }) {
  const vehicles = await listVehicles();
  const parts = await listPartTypes();
  const garages = await all<{ name: string }>("SELECT name FROM garages ORDER BY name");
  const items = d.items ?? [];
  return (
    <form action={saveRecord}>
      {d.draft_id && <input type="hidden" name="draft_id" value={d.draft_id} />}
      <div className="card form">
        <div className="field"><label htmlFor="vehicle_id">Xe</label>
          <select id="vehicle_id" name="vehicle_id" defaultValue={d.vehicle_id} required>
            {vehicles.map((v) => <option key={v.id} value={v.id}>{v.name}{v.plate ? ` — ${v.plate}` : ""}</option>)}
          </select></div>
        <div className="field"><label htmlFor="garage">Garage / đại lý</label>
          <input id="garage" name="garage" list="garages" defaultValue={d.garage} placeholder="VD: Toyota An Sương" />
          <datalist id="garages">{garages.map((g) => <option key={g.name} value={g.name} />)}</datalist></div>
        <div className="field"><label htmlFor="date">Ngày</label><input id="date" type="date" name="date" defaultValue={d.date ?? ""} required /></div>
        <div className="field"><label htmlFor="odo">Số km (ODO)</label><input id="odo" name="odo" inputMode="numeric" defaultValue={d.odo ?? ""} /></div>
      </div>

      <h2>Hạng mục</h2>
      <RecordItems parts={parts.map((p) => ({ id: p.id, name: p.name, category: p.category, kw: p.kw }))} initial={items} blank={blank}
        money={{ slipTotal: d.slip_total, discount: d.discount, vat: d.vat, vatRate: d.vat_rate, vatIncluded: d.vat_included, vatInferred: d.vat_inferred }} />
      <p className="mute">Gán “thuộc linh kiện” để app tính tuổi thọ và so sánh giá. Lần sau tên này sẽ tự được gán.</p>
      <div className="field"><label htmlFor="note">Ghi chú (không bắt buộc)</label><input id="note" name="note" defaultValue={d.note} /></div>
      <button className="btn primary block" type="submit" style={{ marginTop: 14 }}>Lưu phiếu</button>
    </form>
  );
}
