import { notFound } from "next/navigation";
import { all, get } from "../../../lib/db.ts";
import { fmtDate, num, vnd } from "../../../lib/util.ts";
import { deleteRecord } from "../../actions";
import ConfirmButton from "../../components/ConfirmButton";
import { Flash } from "../../components/ui";

export default async function RecordPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string }> }) {
  const id = Number((await params).id);
  const { ok } = await searchParams;
  const r = await get<{ id: number; date: string; odo: number | null; total: number; note: string | null; vehicle: string; garage: string | null; subtotal: number | null; discount: number; vat: number; vat_rate: number | null; vat_included: boolean }>(
    `SELECT s.*, v.name AS vehicle, g.name AS garage FROM service_records s JOIN vehicles v ON v.id = s.vehicle_id
     LEFT JOIN garages g ON g.id = s.garage_id WHERE s.id = ?`, id);
  if (!r) notFound();
  const items = await all<{ raw_name: string; part: string | null; qty: number; amount: number; kind: string }>(
    `SELECT i.raw_name, p.name AS part, i.qty, i.amount, i.kind FROM service_items i
     LEFT JOIN part_types p ON p.id = i.part_type_id WHERE i.record_id = ? ORDER BY i.id`, id);
  return (
    <>
      <Flash text={ok} ok />
      <h1>{r.garage ?? "Phiếu bảo dưỡng"}</h1>
      <p className="sub">{fmtDate(r.date)}{r.odo != null ? ` · ${num(r.odo)} km` : ""} · {r.vehicle}</p>
      <div className="split">
        <div>
          <div className="card">
            <div className="mute">Tổng thanh toán</div><div className="stat">{vnd(r.total)}</div>
            {r.subtotal != null && (r.discount > 0 || r.vat > 0) && (
              <div className="mute" style={{ marginTop: 6 }}>
                Cộng hạng mục {vnd(r.subtotal)}
                {r.discount > 0 && <> · Giảm giá −{vnd(r.discount)}</>}
                {r.vat > 0 && <> · VAT{r.vat_rate ? ` ${r.vat_rate}%` : ""} {vnd(r.vat)} {r.vat_included ? "(đã gồm trong giá)" : "(cộng thêm)"}</>}
              </div>
            )}
            {r.note && <div className="mute">{r.note}</div>}
          </div>
          <div className="list">
            {items.map((i, k) => (
              <div className="li" key={k}>
                <div className="grow"><div className="t">{i.raw_name}</div>
                  <div className="mute">{i.part ?? "Không gán linh kiện"}{i.kind === "labor" ? " · tiền công" : ""}{i.qty !== 1 ? ` · SL ${i.qty}` : ""}</div></div>
                <div className="r">{i.amount ? vnd(i.amount) : "—"}</div>
              </div>))}
          </div>
          <form action={deleteRecord}><input type="hidden" name="id" value={id} /><ConfirmButton label="Xóa phiếu này" message="Xóa phiếu này? Hạn bảo dưỡng của các linh kiện trong phiếu sẽ được tính lại." /></form>
        </div>
      </div>
    </>
  );
}
