import Link from "next/link";
import { notFound } from "next/navigation";
import { COST_ONLY, partLabel, type Category } from "../../../../lib/parts.ts";
import { getVehicle, listPartTypes, vehicleRules } from "../../../../lib/queries.ts";
import { getI18n } from "../../../../lib/settings.ts";
import { saveSetup } from "../../../actions";
import { Flash } from "../../../components/ui";

export default async function Setup({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string }> }) {
  const id = Number((await params).id);
  const { ok } = await searchParams;
  const { t, lang } = await getI18n();
  const v = await getVehicle(id);
  if (!v) notFound();
  const parts = (await listPartTypes()).filter((p) => p.category !== COST_ONLY);
  const rules = new Map((await vehicleRules(id)).map((r) => [r.partTypeId, r]));
  const cats = [...new Set(parts.map((p) => p.category))];
  return (
    <>
      <h1>{t("setup.title", { name: v.name })}</h1>
      <Flash text={ok} ok />
      <p className="sub">{t("setup.sub")}</p>
      <form action={saveSetup}>
        <input type="hidden" name="vehicle_id" value={id} />
        {cats.map((c) => (
          <div key={c}>
            <h2>{t(`cat.${c as Category}`)}</h2>
            <div className="list">
              {parts.filter((p) => p.category === c).map((p) => {
                const last = rules.get(p.id)?.last;
                const name = partLabel(p, lang);
                return (
                  <div className="rule" key={p.id} style={{ gridTemplateColumns: "1fr" }}>
                    <div><div style={{ fontWeight: 600 }}>{name}</div>{last && <div className="mute">{t("setup.has_data")}</div>}</div>
                    <div className="iv" style={{ gridColumn: "1" }}>
                      <input type="date" name={`date_${p.id}`} aria-label={t("setup.date_aria", { part: name })} style={{ width: 160 }} />
                      <input name={`km_${p.id}`} inputMode="numeric" placeholder={t("setup.km_ph")} aria-label={t("setup.km_aria", { part: name })} style={{ width: 140 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        <button className="btn primary block">{t("common.save")}</button>
        <p style={{ textAlign: "center" }}><Link href={`/vehicles/${id}`}>{t("setup.skip")}</Link></p>
      </form>
    </>
  );
}
