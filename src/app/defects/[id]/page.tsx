import Link from "next/link";
import { notFound } from "next/navigation";
import { getDefect } from "../../../lib/queries.ts";
import { getI18n } from "../../../lib/settings.ts";
import ConfirmButton from "../../components/ConfirmButton";
import Icon from "../../components/Icon";
import { Flash } from "../../components/ui";
import { deleteDefect, resolveDefect, updateDefect } from "../../actions";

const SEV_ICON = { high: "alert", medium: "clock", low: "check" } as const;

export default async function DefectPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  const id = Number((await params).id);
  const { ok, error } = await searchParams;
  const { t, fmt } = await getI18n();
  const d = await getDefect(id);
  if (!d) notFound();
  const open = d.status === "open";
  return (
    <>
      <p className="sub"><Link href="/defects" className="back">{t("defects.back")}</Link></p>
      <Flash text={error} />
      <Flash text={ok} ok />
      <div className="card">
        <div className="row" style={{ marginBottom: 10 }}>
          <span className={`sev ${d.severity}`}><Icon n={SEV_ICON[d.severity]} s={14} />{t(`defects.sev_${d.severity}` as const)}</span>
          {!open && <span className="badge b-ok"><Icon n="check" s={14} />{t("defects.fixed_on", { date: fmt.date(d.resolved_at ?? d.date) })}</span>}
          <span className="badge b-unknown">{d.ai ? t("defects.ai_tag") : t("defects.manual_tag")}</span>
        </div>
        <h1 style={{ fontSize: 24, margin: "0 0 4px" }}>{d.title}</h1>
        <div className="mute">{d.vehicle} · {t("defects.at", { date: fmt.date(d.date), odo: d.odo ? fmt.dist(d.odo) : "—" })}</div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {d.thumb && <img className="photo" src={d.thumb} alt={d.title} style={{ marginTop: 14 }} />}
        {d.description && <p style={{ marginTop: 14 }}>{d.description}</p>}
        <dl className="kv">
          {d.area && <><dt>{t("defects.area")}</dt><dd>{d.area}</dd></>}
          {d.advice && <><dt>{t("defects.advice")}</dt><dd>{d.advice}</dd></>}
          {d.user_note && <><dt>{t("defects.your_note")}</dt><dd>{d.user_note}</dd></>}
          {d.resolution && <><dt>{t("defects.resolved_msg")}</dt><dd>{d.resolution}</dd></>}
        </dl>
      </div>

      {open ? (
        <form action={resolveDefect} className="card form">
          <input type="hidden" name="id" value={id} />
          <div className="field"><label htmlFor="resolution">{t("defects.resolve")}</label><input id="resolution" name="resolution" maxLength={300} placeholder={t("defects.resolution_ph")} /></div>
          <button className="btn primary" type="submit"><Icon n="check" s={20} />{t("defects.resolve")}</button>
        </form>
      ) : (
        <form action={resolveDefect} className="actions" style={{ marginBottom: 16 }}>
          <input type="hidden" name="id" value={id} /><input type="hidden" name="reopen" value="1" />
          <button className="btn ghost" type="submit">{t("defects.reopen")}</button>
        </form>
      )}

      <details className="card">
        <summary>{t("defects.edit")}</summary>
        <form action={updateDefect} className="form" style={{ marginTop: 12 }}>
          <input type="hidden" name="id" value={id} />
          <div className="field"><label htmlFor="title">{t("defects.title")}</label><input id="title" name="title" defaultValue={d.title} required maxLength={120} /></div>
          <div className="field"><label htmlFor="description">{t("defects.description")}</label><textarea id="description" name="description" rows={4} defaultValue={d.description} maxLength={800} /></div>
          <div className="field"><label htmlFor="note">{t("defects.your_note")}</label><textarea id="note" name="note" rows={2} defaultValue={d.user_note ?? ""} maxLength={500} /></div>
          <div className="field"><label htmlFor="severity">{t("defects.severity")}</label>
            <select id="severity" name="severity" defaultValue={d.severity}>
              <option value="low">{t("defects.sev_low")}</option><option value="medium">{t("defects.sev_medium")}</option><option value="high">{t("defects.sev_high")}</option>
            </select></div>
          <button className="btn primary" type="submit">{t("defects.save")}</button>
        </form>
      </details>

      <form action={deleteDefect} style={{ marginTop: 20 }}>
        <input type="hidden" name="id" value={id} />
        <ConfirmButton label={t("defects.delete")} message={t("defects.delete_confirm")} />
      </form>
    </>
  );
}
