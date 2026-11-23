import Link from "next/link";
import { listVehicles } from "../../../lib/queries.ts";
import { scanEnabled } from "../../../lib/extract.ts";
import { getI18n } from "../../../lib/settings.ts";
import { today } from "../../../lib/util.ts";
import RecordForm from "../../components/RecordForm";
import ScanForm from "../../components/ScanForm";
import { Flash } from "../../components/ui";
import { scanSlip } from "../../actions";

export const maxDuration = 60;

export default async function NewRecord({ searchParams }: { searchParams: Promise<{ manual?: string; error?: string; ok?: string }> }) {
  const { manual, error } = await searchParams;
  const { t } = await getI18n();
  const vs = await listVehicles();
  if (!vs.length) return <div className="card">{t("rec.need_vehicle")} <Link href="/vehicles">{t("rec.need_vehicle_link")}</Link></div>;

  if (manual) {
    return (
      <>
        <h1>{t("rec.manual_title")}</h1>
        <Flash text={error} />
        <p className="sub"><Link href="/records/new" className="back">{t("rec.back_scan")}</Link></p>
        <RecordForm d={{ date: today() }} blank={3} />
      </>
    );
  }
  const ai = scanEnabled();
  return (
    <>
      <h1>{t("rec.new_title")}</h1>
      <p className="sub">{t("rec.new_sub")}</p>
      <Flash text={error} />
      {ai ? (
        <ScanForm vehicles={vs.map((v) => ({ id: v.id, name: v.name }))} action={scanSlip} />
      ) : (
        <Flash text={t("rec.no_ai")} />
      )}
      <p style={{ textAlign: "center" }}>
        <Link href="/records/new?manual=1" className="btn ghost">{t("rec.manual_btn")}</Link>
      </p>
    </>
  );
}
