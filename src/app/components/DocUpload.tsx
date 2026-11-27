"use client";
import { useId, useState } from "react";
import { shrinkImage, UPLOAD_LIMIT } from "./shrink";
import { useI18n } from "./I18nProvider";
import Icon from "./Icon";

/** Pick a photo/PDF (images are shrunk on the phone first) and send it to a server action that only READS it — the file is never stored. */
export default function DocUpload({ vehicleId, action, label, busy }: { vehicleId: number; action: (f: FormData) => void | Promise<void>; label: string; busy: string }) {
  const { t } = useI18n();
  const fid = useId();
  const [msg, setMsg] = useState("");
  const [working, setWorking] = useState(false);
  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.target;
    const f = input.files?.[0];
    if (!f) return;
    const out = await shrinkImage(f).catch(() => f);
    if (out.size > UPLOAD_LIMIT) { setMsg(t("scan.too_big")); input.value = ""; return; }
    const dt = new DataTransfer(); dt.items.add(out); input.files = dt.files;
    setMsg(t("scan.picked", { name: out.name, kb: (out.size / 1024).toFixed(0) }));
  }
  return (
    <form action={action} onSubmit={() => setWorking(true)} className="stack">
      <input type="hidden" name="vehicle_id" value={vehicleId} />
      <label className="capture" htmlFor={fid} style={{ minHeight: 84, flexDirection: "row", gap: 12 }}>
        <input type="file" name="file" id={fid} accept="image/*,application/pdf" onChange={onPick} required />
        <Icon n="camera" s={26} />
        <span>{msg || t("scan.pick")}</span>
      </label>
      <button className="btn primary block" type="submit" disabled={working}>{working ? busy : label}</button>
    </form>
  );
}
