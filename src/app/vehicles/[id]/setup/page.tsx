import Link from "next/link";
import { notFound } from "next/navigation";
import { COST_ONLY } from "../../../../lib/parts.ts";
import { getVehicle, listPartTypes, vehicleRules } from "../../../../lib/queries.ts";
import { saveSetup } from "../../../actions";
import { Flash } from "../../../components/ui";

export default async function Setup({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string }> }) {
  const id = Number((await params).id);
  const { ok } = await searchParams;
  const v = await getVehicle(id);
  if (!v) notFound();
  const parts = (await listPartTypes()).filter((p) => p.category !== COST_ONLY);
  const rules = new Map((await vehicleRules(id)).map((r) => [r.partTypeId, r]));
  const cats = [...new Set(parts.map((p) => p.category))];
  return (
    <>
      <h1>Lần thay gần nhất — {v.name}</h1>
      <Flash text={ok} ok />
      <p className="sub">Với hạng mục nào anh nhớ, nhập ngày và số km lúc thay. Không nhớ thì để trống, có thể bổ sung sau. Phiếu thật về sau sẽ tự cập nhật mốc này.</p>
      <form action={saveSetup}>
        <input type="hidden" name="vehicle_id" value={id} />
        {cats.map((c) => (
          <div key={c}>
            <h2>{c}</h2>
            <div className="list">
              {parts.filter((p) => p.category === c).map((p) => {
                const last = rules.get(p.id)?.last;
                return (
                  <div className="rule" key={p.id} style={{ gridTemplateColumns: "1fr" }}>
                    <div><div style={{ fontWeight: 600 }}>{p.name}</div>{last && <div className="mute">Đã có dữ liệu</div>}</div>
                    <div className="iv" style={{ gridColumn: "1" }}>
                      <input type="date" name={`date_${p.id}`} aria-label={`Ngày thay ${p.name}`} style={{ width: 160 }} />
                      <input name={`km_${p.id}`} inputMode="numeric" placeholder="Km lúc thay" aria-label={`Km lúc thay ${p.name}`} style={{ width: 140 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        <button className="btn primary block">Lưu</button>
        <p style={{ textAlign: "center" }}><Link href={`/vehicles/${id}`}>Bỏ qua, làm sau</Link></p>
      </form>
    </>
  );
}
