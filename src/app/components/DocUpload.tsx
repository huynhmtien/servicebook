"use client";
import { useState } from "react";
import { shrinkImage, UPLOAD_LIMIT } from "./shrink";
import { useI18n } from "./I18nProvider";

/** Upload an image/PDF (downscaled if an image) to a server action; used for "scan the maintenance table in the manual". */
export default function DocUpload({ vehicleId, action, label, busy }: { vehicleId: number; action: (f: FormData) => void | Promise<void>; label: string; busy: string }) {
  const { t } = useI18n();
  const [msg, setMsg] = useState("");
  const [working, setWorking] = useState(false);
  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const out = await shrinkImage(f).catch(() => f);
    if (out.size > UPLOAD_LIMIT) { setMsg(t("scan.too_big")); e.target.value = ""; return; }
    const dt = new DataTransfer(); dt.items.add(out); e.target.files = dt.files;
    setMsg(t("scan.picked", { name: out.name, kb: (out.size / 1024).toFixed(0) }));
  }
  return (
    <form action={action} onSubmit={() => setWorking(true)}>
      <input type="hidden" name="vehicle_id" value={vehicleId} />
      <input type="file" name="file" id="doc_file" accept="image/*,application/pdf" onChange={onPick} required aria-label={label} style={{ width: "100%" }} />
      {msg && <div className="mute" style={{ margin: "6px 0" }}>{msg}</div>}
      <button className="btn ghost block" type="submit" disabled={working} style={{ marginTop: 8 }}>{working ? busy : label}</button>
    </form>
  );
}
