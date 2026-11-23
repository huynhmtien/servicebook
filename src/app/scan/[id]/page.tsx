import { notFound } from "next/navigation";
import { get } from "../../../lib/db.ts";
import type { Draft } from "../../../lib/extract.ts";
import { vnd } from "../../../lib/util.ts";
import RecordForm from "../../components/RecordForm";
import { Flash } from "../../components/ui";

export default async function Review({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const id = Number((await params).id);
  const { error } = await searchParams;
  const row = await get<{ id: number; vehicle_id: number; data: string }>("SELECT id, vehicle_id, data FROM drafts WHERE id = ?", id);
  if (!row) notFound();
  const d: Draft = JSON.parse(row.data);
  const guessed = d.items.filter((i) => i.how === "keyword" || (i.how === "ai" && (i.confidence ?? 1) < 0.6)).length;
  return (
    <>
      <h1>Kiểm tra trước khi lưu</h1>
      <Flash text={error} />
      <p className="sub">App đã đọc {d.items.length} hạng mục. Đối chiếu với phiếu giấy (ảnh gốc không được lưu) rồi sửa nếu cần.</p>
      {guessed > 0 && <Flash text={`${guessed} dòng được phân loại theo gợi ý tự động/AI chưa chắc — có nhãn vàng, anh soát lại nhé.`} />}
      {d.slip_total != null && <div className="card"><span className="mute">Tổng trên phiếu</span> <b>{vnd(d.slip_total)}</b></div>}
      <RecordForm d={{ vehicle_id: row.vehicle_id, garage: d.garage, date: d.date, odo: d.odo, draft_id: row.id, items: d.items, slip_total: d.slip_total, discount: d.discount, vat: d.vat, vat_rate: d.vat_rate, vat_included: d.vat_included, vat_inferred: d.vat_inferred }} blank={0} />
    </>
  );
}
