import Link from "next/link";
import { listVehicles } from "../../../lib/queries.ts";
import { getI18n } from "../../../lib/settings.ts";
import DefectCapture from "../../components/DefectCapture";
import { Flash } from "../../components/ui";
import { createDefect } from "../../actions";

export const maxDuration = 60;

export default async function NewDefect({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const { t } = await getI18n();
  const vs = await listVehicles();
  return (
    <>
      <p className="sub"><Link href="/defects" className="back">{t("defects.back")}</Link></p>
      <h1>{t("defects.new")}</h1>
      <p className="sub">{t("defects.sub")}</p>
      <Flash text={error} />
      {vs.length ? <div className="card"><DefectCapture vehicles={vs.map((v) => ({ id: v.id, name: v.name }))} action={createDefect} /></div>
        : <div className="card">{t("defects.no_vehicle")} <Link href="/vehicles">{t("rec.need_vehicle_link")}</Link></div>}
    </>
  );
}
