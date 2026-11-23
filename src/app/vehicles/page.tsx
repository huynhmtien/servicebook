import Link from "next/link";
import { listVehicles } from "../../lib/queries.ts";
import { num } from "../../lib/util.ts";
import { addVehicle } from "../actions";
import { Flash } from "../components/ui";

export default async function Vehicles({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  const { ok } = await searchParams;
  const vs = await listVehicles();
  return (
    <>
      <h1>Xe</h1>
      <Flash text={ok} ok />
      {vs.length > 0 && (
        <div className="list">
          {vs.map((v) => (
            <Link key={v.id} href={`/vehicles/${v.id}`} className="li">
              <div className="grow"><div className="t">{v.name}</div><div className="mute">{[v.plate, v.model, v.year].filter(Boolean).join(" · ")}</div></div>
              <div className="r t">{num(v.odo)} km</div>
            </Link>
          ))}
        </div>
      )}
      <h2>Thêm xe</h2>
      <form action={addVehicle} className="card form">
        <div className="field"><label htmlFor="name">Tên gọi *</label><input id="name" name="name" required placeholder="VD: Fortuner nhà" /></div>
        <div className="field"><label htmlFor="plate">Biển số</label><input id="plate" name="plate" /></div>
        <div className="field"><label htmlFor="model">Hãng / dòng xe</label><input id="model" name="model" placeholder="Toyota Fortuner" /></div>
        <div className="field"><label htmlFor="year">Năm sản xuất</label><input id="year" name="year" inputMode="numeric" /></div>
        <div className="field"><label htmlFor="odo">ODO hiện tại (km) *</label><input id="odo" name="odo" inputMode="numeric" required /></div>
        <button className="btn primary" type="submit">Thêm xe</button>
      </form>
      <p><Link href="/settings">Cài đặt Telegram, AI, mật khẩu →</Link></p>
    </>
  );
}
