"use client";
import { useState } from "react";
import { shrinkImage, UPLOAD_LIMIT } from "./shrink";

/** Tải ảnh/PDF (đã thu nhỏ nếu là ảnh) lên một server action; dùng cho "quét bảng bảo dưỡng trong sổ". */
export default function DocUpload({ vehicleId, action, label, busy }: { vehicleId: number; action: (f: FormData) => void | Promise<void>; label: string; busy: string }) {
  const [msg, setMsg] = useState("");
  const [working, setWorking] = useState(false);
  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const out = await shrinkImage(f).catch(() => f);
    if (out.size > UPLOAD_LIMIT) { setMsg("File quá lớn (>3,5MB). Hãy chụp lại ảnh."); e.target.value = ""; return; }
    const dt = new DataTransfer(); dt.items.add(out); e.target.files = dt.files;
    setMsg(`✔ ${out.name} (${(out.size / 1024).toFixed(0)} KB)`);
  }
  return (
    <form action={action} onSubmit={() => setWorking(true)}>
      <input type="hidden" name="vehicle_id" value={vehicleId} />
      <input type="file" name="file" id="doc_file" accept="image/*,application/pdf" onChange={onPick} required aria-label="Ảnh bảng bảo dưỡng trong sổ hướng dẫn" style={{ width: "100%" }} />
      {msg && <div className="mute" style={{ margin: "6px 0" }}>{msg}</div>}
      <button className="btn ghost block" type="submit" disabled={working} style={{ marginTop: 8 }}>{working ? busy : label}</button>
    </form>
  );
}
