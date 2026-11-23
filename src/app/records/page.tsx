import Link from "next/link";
import { recordsFor } from "../../lib/queries.ts";
import { fmtDate, num, vnd } from "../../lib/util.ts";
import { Flash } from "../components/ui";

export default async function Records({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  const { ok } = await searchParams;
  const recs = (await recordsFor()).filter((r) => r.total > 0 || r.note !== "Nhập dữ liệu ban đầu");
  return (
    <>
      <h1>Lịch sử bảo dưỡng</h1>
      <Flash text={ok} ok />
      <p className="sub">Tất cả phiếu đã lưu, mới nhất ở trên.</p>
      {recs.length === 0 ? (
        <div className="card">Chưa có phiếu nào. <Link href="/records/new">Thêm phiếu đầu tiên</Link></div>
      ) : (
        <div className="list">
          {recs.map((r) => (
            <Link key={r.id} href={`/records/${r.id}`} className="li">
              <div className="grow">
                <div className="t">{r.garage ?? "Không rõ garage"}</div>
                <div className="mute">{fmtDate(r.date)}{r.odo != null ? ` · ${num(r.odo)} km` : ""} · {r.items} hạng mục{r.vehicle ? ` · ${r.vehicle}` : ""}</div>
              </div>
              <div className="r t">{vnd(r.total)}</div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
