import Link from "next/link";
import { notFound } from "next/navigation";
import { getVehicle, vehicleRules, vehicleAvgKmPerDay } from "../../../lib/queries.ts";
import { fmtDate, num } from "../../../lib/util.ts";
import { Badge, describe, Flash } from "../../components/ui";
import ConfirmButton from "../../components/ConfirmButton";
import { deleteVehicle, researchIntervalsAction, saveRules, scanIntervalDoc, updateOdo, updateVehicle } from "../../actions";
import DocUpload from "../../components/DocUpload";
import { researchProviders } from "../../../lib/intervals.ts";

export const maxDuration = 60;

function SourceTag({ r }: { r: { source: string; sourceUrl: string | null; sourceNote: string | null } }) {
  const t = r.source === "doc" ? { c: "b-ok", l: "Theo sổ hướng dẫn" } : r.source === "user" ? { c: "b-ok", l: "Anh tự đặt" }
    : r.source === "ai" ? { c: "b-info", l: "AI tra cứu" } : { c: "b-unknown", l: "Mặc định chung · chưa xác thực" };
  return (
    <span className="row" style={{ gap: 6 }}>
      <span className={`badge ${t.c}`}>{t.l}</span>
      {r.sourceUrl && <a href={r.sourceUrl} target="_blank" rel="noreferrer" style={{ fontSize: 13 }}>nguồn</a>}
    </span>
  );
}

export default async function VehiclePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  const id = Number((await params).id);
  const { ok, error } = await searchParams;
  const v = await getVehicle(id);
  if (!v) notFound();
  const order = { overdue: 0, soon: 1, ok: 2, unknown: 3 } as const;
  const all = (await vehicleRules(id)).sort((a, b) => order[a.status] - order[b.status] || a.urgency - b.urgency);
  const rules = [...all.filter((r) => r.intervalKm != null || r.intervalMonths != null), ...all.filter((r) => r.intervalKm == null && r.intervalMonths == null)];
  const canSearch = researchProviders().length > 0;
  const avg = await vehicleAvgKmPerDay(id);
  return (
    <>
      <p className="sub"><Link href="/vehicles">← Danh sách xe</Link></p>
      <h1>{v.name}</h1>
      <p className="sub">{[v.plate, v.model, v.year].filter(Boolean).join(" · ")}</p>
      <Flash text={error} />
      <Flash text={ok} ok />
      <div className="card">
        <div className="mute">ODO hiện tại</div><div className="stat">{num(v.odo)} km</div>
        <div className="mute">≈ {num(avg)} km/ngày (tính từ lịch sử ODO)</div>
        <form action={updateOdo} className="row" style={{ marginTop: 12, flexWrap: "nowrap" }}>
          <input type="hidden" name="vehicle_id" value={id} />
          <input type="hidden" name="back" value={`/vehicles/${id}`} />
          <input name="km" inputMode="numeric" placeholder="ODO mới" aria-label="ODO mới" style={{ flex: 1, minWidth: 0 }} required /><button>Cập nhật</button>
        </form>
      </div>

      <details className="card">
        <summary>Sửa thông tin xe</summary>
        <form action={updateVehicle} className="form" style={{ marginTop: 12 }}>
          <input type="hidden" name="id" value={id} />
          <div className="field"><label htmlFor="e_name">Tên gọi *</label><input id="e_name" name="name" defaultValue={v.name} required /></div>
          <div className="field"><label htmlFor="e_plate">Biển số</label><input id="e_plate" name="plate" defaultValue={v.plate ?? ""} /></div>
          <div className="field"><label htmlFor="e_model">Hãng / dòng xe</label><input id="e_model" name="model" defaultValue={v.model ?? ""} /></div>
          <div className="field"><label htmlFor="e_year">Năm sản xuất</label><input id="e_year" name="year" inputMode="numeric" defaultValue={v.year ?? ""} /></div>
          <div className="field"><label htmlFor="e_odo">ODO hiện tại (km)</label><input id="e_odo" name="odo" inputMode="numeric" defaultValue={v.odo} /></div>
          <button className="btn primary" type="submit">Lưu thông tin</button>
        </form>
      </details>

      <div className="card" id="intervals">
        <b>Chu kỳ thay lấy từ đâu?</b>
        <p className="mute" style={{ margin: "6px 0 12px" }}>
          Các con số có nhãn <b>“Mặc định chung · chưa xác thực”</b> là mức tham khảo phổ biến, <b>chưa theo đúng dòng xe của anh</b>.
          Chu kỳ chuẩn nằm trong <b>sổ hướng dẫn sử dụng / sổ bảo hành bảo dưỡng</b> của xe. Anh có hai cách để thay bằng số đúng:
        </p>
        <form action={researchIntervalsAction} style={{ marginBottom: 12 }}>
          <input type="hidden" name="vehicle_id" value={id} />
          <button className="btn primary block" type="submit" disabled={!canSearch}>Tra cứu theo {[v.model, v.year].filter(Boolean).join(" ") || "dòng xe"} (AI tìm trên web)</button>
          <div className="mute" style={{ marginTop: 6 }}>{canSearch ? "AI tìm lịch bảo dưỡng của hãng và đưa ra đề xuất kèm nguồn; anh duyệt từng dòng, không tự áp dụng. Mất khoảng 20–60 giây." : "Cần GEMINI_API_KEY hoặc ANTHROPIC_API_KEY để tra cứu web."}</div>
        </form>
        <div style={{ borderTop: ".5px solid var(--line)", paddingTop: 12 }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Chính xác nhất: chụp bảng bảo dưỡng trong sổ hướng dẫn</div>
          <DocUpload vehicleId={id} action={scanIntervalDoc} label="Đọc bảng bảo dưỡng" busy="Đang đọc bảng… (10–30 giây)" />
        </div>
      </div>

      <div className="row" style={{ justifyContent: "space-between" }}>
        <h2 style={{ margin: "16px 0 8px" }}>Linh kiện & chu kỳ</h2>
        <Link href={`/vehicles/${id}/setup`} className="btn ghost">Nhập lần thay ban đầu</Link>
      </div>
      <form action={saveRules}>
        <input type="hidden" name="vehicle_id" value={id} />
        <div className="list">
          {rules.map((r) => (
            <div className="rule" key={r.ruleId}>
              <input type="checkbox" name={`on_${r.ruleId}`} defaultChecked={r.enabled} aria-label={`Theo dõi ${r.partName}`} />
              <div><div style={{ fontWeight: 600 }}>{r.partName}</div>
                <div className="mute">{r.last ? `Thay ${fmtDate(r.last.date)}${r.last.odo != null ? ` @ ${num(r.last.odo)} km` : ""}${r.last.garage ? ` · ${r.last.garage}` : ""}` : "Chưa có lần thay"}
                  {r.status !== "unknown" && ` · ${describe(r)}`}</div>
                {(r.intervalKm != null || r.intervalMonths != null) && <div style={{ marginTop: 4 }}><SourceTag r={r} /></div>}</div>
              {r.intervalKm == null && r.intervalMonths == null ? <span className="badge b-unknown">Chưa đặt chu kỳ</span> : <Badge s={r.status} />}
              <details className="iv-box">
                <summary className="mute">Chu kỳ: {[r.intervalKm != null ? `${num(r.intervalKm)} km` : null, r.intervalMonths != null ? `${r.intervalMonths} tháng` : null].filter(Boolean).join(" hoặc ") || "chưa đặt"} · sửa</summary>
                {r.sourceNote && <div className="mute" style={{ margin: "6px 0 2px" }}>{r.sourceNote}</div>}
                <div className="iv">
                  <span className="mute">Mỗi</span>
                  <input name={`km_${r.ruleId}`} defaultValue={r.intervalKm ?? ""} inputMode="numeric" aria-label={`Chu kỳ km ${r.partName}`} placeholder="km" /> <span className="mute">km hoặc</span>
                  <input name={`mo_${r.ruleId}`} defaultValue={r.intervalMonths ?? ""} inputMode="numeric" aria-label={`Chu kỳ tháng ${r.partName}`} placeholder="tháng" /> <span className="mute">tháng (cái nào tới trước)</span>
                </div>
              </details>
            </div>))}
        </div>
        <button className="btn primary block">Lưu chu kỳ</button>
      </form>

      <form action={deleteVehicle} style={{ marginTop: 28 }}>
        <input type="hidden" name="id" value={id} />
        <ConfirmButton label="Xóa xe này (và toàn bộ phiếu)" message="Xóa xe này cùng toàn bộ phiếu bảo dưỡng của nó? Không hoàn tác được." />
      </form>
    </>
  );
}
