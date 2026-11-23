"use client";
import { useRef, useState } from "react";
import { shrinkImage, UPLOAD_LIMIT } from "./shrink";

export default function ScanForm({
  vehicles, action,
}: {
  vehicles: { id: number; name: string }[];
  action: (f: FormData) => void | Promise<void>;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const out = await shrinkImage(f);
      if (out.size > UPLOAD_LIMIT) {
        setMsg("File quá lớn (>3,5MB). Hãy chụp lại ảnh hoặc dùng ảnh thay vì PDF dung lượng lớn.");
        e.target.value = "";
        return;
      }
      const dt = new DataTransfer();
      dt.items.add(out);
      e.target.files = dt.files;
      setMsg(`✔ Đã chọn: ${out.name} (${(out.size / 1024).toFixed(0)} KB)`);
    } catch {
      setMsg("");
    }
  }

  return (
    <form action={action} onSubmit={() => setBusy(true)} className="card">
      <div className="field"><label htmlFor="vehicle_id">Xe</label>
        <select id="vehicle_id" name="vehicle_id">{vehicles.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</select></div>
      <input ref={ref} id="file" type="file" name="file" accept="image/*,application/pdf" onChange={onPick} required
        style={{ position: "absolute", width: 1, height: 1, opacity: 0 }} />
      <label htmlFor="file" className="btn ghost block" style={{ margin: "14px 0 6px", minHeight: 96, flexDirection: "column", borderStyle: "dashed", fontSize: 17, cursor: "pointer" }}>
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" /></svg>
        {msg || "Chụp ảnh hoặc chọn file phiếu"}
      </label>
      {msg && <div className="mute" style={{ textAlign: "center" }}>Bấm vào khung trên để đổi ảnh khác</div>}
      <button className="btn primary block" type="submit" disabled={busy} style={{ marginTop: 14 }}>
        {busy ? "Đang đọc phiếu… (10–30 giây, đừng thoát trang)" : "Đọc phiếu"}
      </button>
    </form>
  );
}
