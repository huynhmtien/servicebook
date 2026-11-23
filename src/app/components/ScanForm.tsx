"use client";
import { useRef, useState } from "react";
import { shrinkImage, UPLOAD_LIMIT } from "./shrink";
import { useI18n } from "./I18nProvider";

export default function ScanForm({
  vehicles, action,
}: {
  vehicles: { id: number; name: string }[];
  action: (f: FormData) => void | Promise<void>;
}) {
  const { t } = useI18n();
  const ref = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const out = await shrinkImage(f);
      if (out.size > UPLOAD_LIMIT) {
        setMsg(t("scan.too_big"));
        e.target.value = "";
        return;
      }
      const dt = new DataTransfer();
      dt.items.add(out);
      e.target.files = dt.files;
      setMsg(t("scan.picked", { name: out.name, kb: (out.size / 1024).toFixed(0) }));
    } catch {
      setMsg("");
    }
  }

  return (
    <form action={action} onSubmit={() => setBusy(true)} className="card">
      <div className="field"><label htmlFor="vehicle_id">{t("scan.vehicle")}</label>
        <select id="vehicle_id" name="vehicle_id">{vehicles.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</select></div>
      <input ref={ref} id="file" type="file" name="file" accept="image/*,application/pdf" onChange={onPick} required
        style={{ position: "absolute", width: 1, height: 1, opacity: 0 }} />
      <label htmlFor="file" className="btn ghost block" style={{ margin: "14px 0 6px", minHeight: 96, flexDirection: "column", borderStyle: "dashed", fontSize: 17, cursor: "pointer" }}>
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" /></svg>
        {msg || t("scan.pick")}
      </label>
      {msg && <div className="mute" style={{ textAlign: "center" }}>{t("scan.change")}</div>}
      <button className="btn primary block" type="submit" disabled={busy} style={{ marginTop: 14 }}>
        {busy ? t("scan.busy") : t("scan.submit")}
      </button>
    </form>
  );
}
