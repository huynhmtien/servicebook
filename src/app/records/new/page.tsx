import Link from "next/link";
import { listVehicles } from "../../../lib/queries.ts";
import { scanEnabled } from "../../../lib/extract.ts";
import { today } from "../../../lib/util.ts";
import RecordForm from "../../components/RecordForm";
import ScanForm from "../../components/ScanForm";
import { Flash } from "../../components/ui";
import { scanSlip } from "../../actions";

export const maxDuration = 60;

export default async function NewRecord({ searchParams }: { searchParams: Promise<{ manual?: string; error?: string; ok?: string }> }) {
  const { manual, error, ok } = await searchParams;
  const vs = await listVehicles();
  if (!vs.length) return <div className="card">Anh cần <Link href="/vehicles">thêm xe</Link> trước.</div>;

  if (manual) {
    return (
      <>
        <h1>Nhập phiếu bằng tay</h1>
        <Flash text={error} />
        <p className="sub"><Link href="/records/new">← Quay lại chụp ảnh phiếu</Link></p>
        <RecordForm d={{ date: today() }} blank={3} />
      </>
    );
  }
  const ai = scanEnabled();
  return (
    <>
      <h1>Thêm phiếu bảo dưỡng</h1>
      <p className="sub">Chụp hoặc chọn ảnh phiếu, app tự điền sẵn, anh chỉ cần kiểm tra rồi lưu.</p>
      <Flash text={error} />
      {ai ? (
        <ScanForm vehicles={vs.map((v) => ({ id: v.id, name: v.name }))} action={scanSlip} />
      ) : (
        <Flash text="Chưa có khóa AI (GEMINI_API_KEY / DEEPSEEK_API_KEY / ANTHROPIC_API_KEY) nên chưa đọc được ảnh. Anh vẫn nhập tay được bên dưới." />
      )}
      <p style={{ textAlign: "center" }}>
        <Link href="/records/new?manual=1" className="btn ghost">Không có ảnh? Nhập tay</Link>
      </p>
    </>
  );
}
