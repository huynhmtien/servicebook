import Link from "next/link";
import { recordsFor } from "../../lib/queries.ts";
import { getI18n } from "../../lib/settings.ts";
import { INITIAL_NOTE } from "../../lib/util.ts";
import { Flash } from "../components/ui";

export default async function Records({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  const { ok } = await searchParams;
  const { t, fmt } = await getI18n();
  // phiếu tạo ở bước "nhập lần thay ban đầu" không hiện trong lịch sử
  const recs = (await recordsFor()).filter((r) => r.total > 0 || r.note !== INITIAL_NOTE);
  return (
    <>
      <h1>{t("rec.history_title")}</h1>
      <Flash text={ok} ok />
      <p className="sub">{t("rec.history_sub")}</p>
      {recs.length === 0 ? (
        <div className="card">{t("rec.history_empty")}<Link href="/records/new">{t("rec.history_add")}</Link></div>
      ) : (
        <div className="list">
          {recs.map((r) => (
            <Link key={r.id} href={`/records/${r.id}`} className="li">
              <div className="grow">
                <div className="t">{r.garage ?? t("rec.unknown_garage")}</div>
                <div className="mute">{fmt.date(r.date)}{r.odo != null ? ` · ${fmt.dist(r.odo)}` : ""} · {t("rec.items_count", { count: r.items })}{r.vehicle ? ` · ${r.vehicle}` : ""}</div>
              </div>
              <div className="r t">{fmt.money(r.total)}</div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
