import { notFound } from "next/navigation";
import { all, get } from "../../../lib/db.ts";
import { getI18n } from "../../../lib/settings.ts";
import { partLabel } from "../../../lib/parts.ts";
import { INITIAL_NOTE } from "../../../lib/util.ts";
import { deleteRecord } from "../../actions";
import ConfirmButton from "../../components/ConfirmButton";
import { Flash } from "../../components/ui";

export default async function RecordPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string }> }) {
  const id = Number((await params).id);
  const { ok } = await searchParams;
  const { t, fmt, lang } = await getI18n();
  const r = await get<{ id: number; date: string; odo: number | null; total: number; note: string | null; vehicle: string; garage: string | null; subtotal: number | null; discount: number; vat: number; vat_rate: number | null; vat_included: number }>(
    `SELECT s.*, v.name AS vehicle, g.name AS garage FROM service_records s JOIN vehicles v ON v.id = s.vehicle_id
     LEFT JOIN garages g ON g.id = s.garage_id WHERE s.id = ?`, id);
  if (!r) notFound();
  const items = await all<{ raw_name: string; part_key: string | null; part: string | null; qty: number; amount: number; kind: string }>(
    `SELECT i.raw_name, p.key AS part_key, p.name AS part, i.qty, i.amount, i.kind FROM service_items i
     LEFT JOIN part_types p ON p.id = i.part_type_id WHERE i.record_id = ? ORDER BY i.id`, id);
  return (
    <>
      <Flash text={ok} ok />
      <h1>{r.garage ?? t("rec.detail_default_title")}</h1>
      <p className="sub">{fmt.date(r.date)}{r.odo != null ? ` · ${fmt.dist(r.odo)}` : ""} · {r.vehicle}</p>
      <div className="split">
        <div>
          <div className="card">
            <div className="mute">{t("rec.total_paid")}</div><div className="stat">{fmt.money(r.total)}</div>
            {r.subtotal != null && (r.discount > 0 || r.vat > 0) && (
              <div className="mute" style={{ marginTop: 6 }}>
                {t("rec.subtotal", { amount: fmt.money(r.subtotal) })}
                {r.discount > 0 && t("rec.discount", { amount: fmt.money(r.discount) })}
                {r.vat > 0 && t("rec.tax", { label: fmt.taxLabel, rate: r.vat_rate ? ` ${r.vat_rate}%` : "", amount: fmt.money(r.vat), mode: r.vat_included ? t("rec.tax_included") : t("rec.tax_added") })}
              </div>
            )}
            {r.note && r.note !== INITIAL_NOTE && <div className="mute">{r.note}</div>}
          </div>
          <div className="list">
            {items.map((i, k) => (
              <div className="li" key={k}>
                <div className="grow"><div className="t">{i.raw_name}</div>
                  <div className="mute">{i.part ? partLabel({ key: i.part_key, name: i.part }, lang) : t("rec.no_part")}{i.kind === "labor" ? t("rec.labor_suffix") : ""}{i.qty !== 1 ? t("rec.qty", { qty: i.qty }) : ""}</div></div>
                <div className="r">{i.amount ? fmt.money(i.amount) : "—"}</div>
              </div>))}
          </div>
          <form action={deleteRecord}><input type="hidden" name="id" value={id} /><ConfirmButton label={t("rec.delete")} message={t("rec.delete_confirm")} /></form>
        </div>
      </div>
    </>
  );
}
