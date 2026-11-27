"use client";
import { useState } from "react";
import { makeThumb, shrinkImage, UPLOAD_LIMIT } from "./shrink";
import { useI18n } from "./I18nProvider";
import Icon from "./Icon";

/** Snap → compress on the phone → server action: AI describes it and the report is saved. Only a ~40 KB thumbnail is kept as evidence. */
export default function DefectCapture({ vehicles, action }: { vehicles: { id: number; name: string }[]; action: (f: FormData) => void | Promise<void> }) {
  const { t } = useI18n();
  const [thumb, setThumb] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.target;
    const f = input.files?.[0];
    if (!f) return;
    try {
      const [out, th] = await Promise.all([shrinkImage(f), makeThumb(f)]);
      if (out.size > UPLOAD_LIMIT) { setMsg(t("scan.too_big")); input.value = ""; return; }
      const dt = new DataTransfer(); dt.items.add(out); input.files = dt.files;
      setThumb(th); setMsg("");
    } catch { setMsg(""); }
  }

  return (
    <form action={action} onSubmit={() => setBusy(true)} className="form">
      {vehicles.length > 1 && (
        <div className="field"><label htmlFor="vehicle_id">{t("scan.vehicle")}</label>
          <select id="vehicle_id" name="vehicle_id">{vehicles.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</select></div>
      )}
      {vehicles.length === 1 && <input type="hidden" name="vehicle_id" value={vehicles[0].id} />}
      <input type="hidden" name="thumb" value={thumb} />
      <label className="capture" htmlFor="defect_file" style={{ margin: 0 }}>
        <input id="defect_file" type="file" name="file" accept="image/*" onChange={onPick} />
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb} alt="" />
        ) : <Icon n="camera" s={36} />}
        <span>{thumb ? t("defects.pick_again") : t("defects.pick")}</span>
      </label>
      <p className="mute" style={{ margin: 0 }}>{msg || t("defects.photo_hint")}</p>
      <div className="field"><label htmlFor="note">{t("defects.note_label")}</label>
        <textarea id="note" name="note" rows={3} maxLength={500} placeholder={t("defects.note_ph")} /></div>
      <button className="btn primary block" type="submit" disabled={busy}>{busy ? t("defects.busy") : t("defects.submit")}</button>
    </form>
  );
}
