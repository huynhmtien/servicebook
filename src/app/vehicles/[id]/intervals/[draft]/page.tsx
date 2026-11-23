import Link from "next/link";
import { notFound } from "next/navigation";
import { all, get } from "../../../../../lib/db.ts";
import type { IntervalProposal } from "../../../../../lib/intervals.ts";
import { num } from "../../../../../lib/util.ts";
import { applyIntervals } from "../../../../actions";
import { Flash } from "../../../../components/ui";

const CONF = { high: { c: "b-ok", l: "Tin cậy cao" }, medium: { c: "b-soon", l: "Trung bình — nên đối chiếu" }, low: { c: "b-overdue", l: "Thấp — chưa chắc" } } as const;

export default async function IntervalReview({ params }: { params: Promise<{ id: string; draft: string }> }) {
  const { id, draft } = await params;
  const vid = Number(id);
  const row = await get<{ data: string }>("SELECT data FROM drafts WHERE id = ? AND vehicle_id = ?", Number(draft), vid);
  if (!row) notFound();
  const p = JSON.parse(row.data) as IntervalProposal;
  if (p.kind !== "intervals") notFound();
  const names = new Map((await all<{ id: number; name: string }>("SELECT id, name FROM part_types")).map((x) => [x.id, x.name]));
  const cur = new Map((await all<{ part_type_id: number; interval_km: number | null; interval_months: number | null; source: string }>(
    "SELECT part_type_id, interval_km, interval_months, source FROM rules WHERE vehicle_id = ?", vid)).map((x) => [x.part_type_id, x]));
  return (
    <>
      <p className="sub"><Link href={`/vehicles/${vid}#intervals`}>← Quay lại xe</Link></p>
      <h1>Duyệt chu kỳ đề xuất</h1>
      <p className="sub">{p.origin === "doc" ? "Đọc từ bảng bảo dưỡng trong sổ hướng dẫn." : `AI tra cứu trên web${p.vehicle_desc ? ` cho: ${p.vehicle_desc}` : ""}.`} Chỉ những dòng anh tích mới được áp dụng.</p>
      <Flash text="Đây là ĐỀ XUẤT, không phải sự thật tuyệt đối. Hãy đối chiếu với sổ hướng dẫn của xe, nhất là các dòng nhãn vàng/đỏ. Anh sửa được số trước khi áp dụng." />
      {p.caveats && <div className="card"><b>Lưu ý từ AI</b><div className="mute" style={{ marginTop: 4 }}>{p.caveats}</div></div>}
      {p.sources.length > 0 && (
        <div className="card"><b>Nguồn đã tham khảo</b>
          <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>{p.sources.slice(0, 8).map((s) => <li key={s.url}><a href={s.url} target="_blank" rel="noreferrer">{s.title}</a></li>)}</ul></div>
      )}

      <form action={applyIntervals}>
        <input type="hidden" name="vehicle_id" value={vid} />
        <input type="hidden" name="draft_id" value={draft} />
        {p.items.map((it) => {
          const c = cur.get(it.part_type_id);
          const conf = CONF[it.confidence];
          return (
            <div className="item" key={it.part_type_id} style={{ gridTemplateColumns: "1fr 1fr" }}>
              <div className="full row" style={{ justifyContent: "space-between", flexWrap: "nowrap" }}>
                <label style={{ margin: 0, display: "flex", gap: 10, alignItems: "center", color: "var(--text)", fontSize: 17 }}>
                  <input type="checkbox" name={`apply_${it.part_type_id}`} defaultChecked={it.confidence !== "low"} />
                  <b>{names.get(it.part_type_id)}</b>
                </label>
                <span className={`badge ${conf.c}`}>{conf.l}</span>
              </div>
              <div className="full mute">Hiện tại: {c ? `${c.interval_km != null ? num(c.interval_km) + " km" : "—"} / ${c.interval_months != null ? c.interval_months + " tháng" : "—"}` : "—"}</div>
              <div><label htmlFor={`km_${it.part_type_id}`}>Chu kỳ (km)</label><input id={`km_${it.part_type_id}`} name={`km_${it.part_type_id}`} inputMode="numeric" defaultValue={it.interval_km ?? ""} /></div>
              <div><label htmlFor={`mo_${it.part_type_id}`}>Chu kỳ (tháng)</label><input id={`mo_${it.part_type_id}`} name={`mo_${it.part_type_id}`} inputMode="numeric" defaultValue={it.interval_months ?? ""} /></div>
              {(it.note || it.source_url) && (
                <div className="full mute">{it.note}{it.source_url && <> {" "}<a href={it.source_url} target="_blank" rel="noreferrer">xem nguồn</a></>}</div>
              )}
            </div>
          );
        })}
        <button className="btn primary block" type="submit">Áp dụng các dòng đã chọn</button>
      </form>
    </>
  );
}
