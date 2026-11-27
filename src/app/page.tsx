import Link from "next/link";
import { all, get } from "../lib/db.ts";
import { listVehicles, vehicleRules, vehicleAvgKmPerDay, listDefects } from "../lib/queries.ts";
import { computeHealth } from "../lib/health.ts";
import { telegramConfigured } from "../lib/telegram.ts";
import { scanEnabled } from "../lib/extract.ts";
import { INITIAL_NOTE, addMonths, today } from "../lib/util.ts";
import { getI18n } from "../lib/settings.ts";
import { partLabel } from "../lib/parts.ts";
import { AlertItem, Flash, Ring } from "./components/ui";
import Icon from "./components/Icon";
import { updateOdo } from "./actions";

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { ok, error } = await searchParams;
  const { t, fmt, lang, settings } = await getI18n();
  const vehicles = await listVehicles();
  const openDefects = await listDefects({ status: "open" });
  const data = await Promise.all(vehicles.map(async (v) => {
    const rules = (await vehicleRules(v.id)).filter((r) => r.enabled);
    const alerts = rules.filter((r) => r.status === "overdue" || r.status === "soon").sort((a, b) => a.urgency - b.urgency);
    const defects = openDefects.filter((d) => d.vehicle_id === v.id);
    const health = computeHealth(rules, defects.map((d) => d.severity));
    return { v, rules, alerts, defects, health, avg: await vehicleAvgKmPerDay(v.id) };
  }));
  const realRecords = (await get<{ n: number }>("SELECT COUNT(*) AS n FROM service_records WHERE COALESCE(note,'') <> ?", INITIAL_NOTE))?.n ?? 0;

  const steps = [
    { t: t("dash.step_prefs"), href: "/settings", done: settings.confirmed },
    { t: t("dash.step_vehicle"), href: "/vehicles", done: vehicles.length > 0 },
    { t: t("dash.step_ai"), href: "/settings#keys", done: scanEnabled() },
    { t: t("dash.step_slip"), href: "/records/new", done: realRecords > 0 },
    { t: t("dash.step_telegram"), href: "/settings", done: telegramConfigured() },
  ];
  const doneSteps = steps.filter((s) => s.done).length;
  const onboarding = doneSteps < steps.length;

  const todayStr = today();
  const from = addMonths(todayStr.slice(0, 8) + "01", -11);
  const monthly = await all<{ m: string; total: number }>(
    "SELECT substr(date,1,7) AS m, SUM(total) AS total FROM service_records WHERE date >= ? GROUP BY m", from,
  );
  const series = Array.from({ length: 12 }, (_, i) => addMonths(from, i).slice(0, 7)).map((m) => ({ m, total: monthly.find((x) => x.m === m)?.total ?? 0 }));
  const max = Math.max(1, ...series.map((s) => s.total));
  const year = series.reduce((a, b) => a + b.total, 0);
  const curMonth = todayStr.slice(0, 7);
  const sevIcon = { high: "alert", medium: "clock", low: "check" } as const;

  return (
    <>
      <div className="titlebar"><h1>{t("dash.title")}</h1><Link href="/settings" className="icon-btn" aria-label={t("common.settings")}><Icon n="gear" s={24} /></Link></div>

      {!process.env.APP_PASSWORD && <Flash text={t("warn.no_password")} />}
      <Flash text={error} />
      <Flash text={ok} ok />

      {onboarding && (
        <details className="card">
          <summary style={{ fontWeight: 700 }}>{t("dash.setup_progress", { done: doneSteps, total: steps.length })}</summary>
          <div className="prog" aria-hidden="true"><i style={{ width: `${(doneSteps / steps.length) * 100}%` }} /></div>
          <div className="steps" style={{ marginTop: 12 }}>
            {steps.map((s, i) => (
              <div key={i} className={`step${s.done ? " done" : ""}`}>
                <span className="n">{s.done ? <><Icon n="check" s={16} /><span className="sr-only">{t("common.done")}: </span></> : i + 1}</span>
                {s.done ? <span className="t">{s.t}</span> : <Link href={s.href} className="t">{s.t}</Link>}
              </div>
            ))}
          </div>
        </details>
      )}

      {data.map(({ v, rules, alerts, defects, health, avg }) => {
        const unknown = rules.filter((r) => r.status === "unknown" && (r.intervalKm != null || r.intervalMonths != null)).length;
        const levelText = t(`dash.health_${health.level}` as const);
        return (
          <section key={v.id} aria-label={v.name}>
            <div className={`hh ${health.level}`}>
              <div className="hh-top">
                <Ring score={health.score} aria={t("dash.score_aria", { n: health.score })} />
                <div className="hh-info">
                  <div className="hh-name">{v.name}</div>
                  {v.plate && <span className="hh-plate">{v.plate}</span>}
                  <div className="hh-level"><Icon n={health.level === "good" ? "check" : health.level === "watch" ? "clock" : "alert"} s={17} />{levelText}</div>
                </div>
              </div>
              <div className="hh-odo"><b>{fmt.dist(v.odo)}</b><span>{t("dash.per_day", { n: fmt.num(avg), unit: fmt.unit })}</span></div>
              <div className="hh-stats">
                <a href="#focus" className={health.overdue ? "bad" : ""}><b>{health.overdue}</b><span>{t("dash.stat_overdue")}</span></a>
                <a href="#focus" className={health.soon ? "warn" : ""}><b>{health.soon}</b><span>{t("dash.stat_soon")}</span></a>
                <div className="good"><b>{health.ok}</b><span>{t("dash.stat_ok")}</span></div>
                <Link href="/defects" className={health.openDefects ? "bad" : ""}><b>{health.openDefects}</b><span>{t("dash.stat_issues")}</span></Link>
              </div>
              <form action={updateOdo} className="hh-form">
                <input type="hidden" name="vehicle_id" value={v.id} />
                <input type="hidden" name="back" value="/" />
                <input name="km" inputMode="numeric" placeholder={t("dash.odo_placeholder")} aria-label={t("dash.odo_aria")} required />
                <button type="submit">{t("common.update")}</button>
              </form>
              {unknown > 0 && <div className="hh-note">{t("dash.coverage", { n: unknown })}<Link href="/records/new">{t("dash.coverage_link")}</Link></div>}
            </div>

            <div className="tiles">
              <Link href="/records/new" className="tile"><span className="ic"><Icon n="scan" s={22} /></span>{t("dash.action_scan")}</Link>
              <Link href="/defects/new" className="tile warn"><span className="ic"><Icon n="alert" s={22} /></span>{t("dash.action_issue")}</Link>
              <Link href="/compare" className="tile"><span className="ic"><Icon n="wallet" s={22} /></span>{t("dash.action_costs")}</Link>
            </div>

            <div className="sec" id="focus"><h2>{t("dash.focus")}</h2>{alerts.length > 5 && <Link href={`/vehicles/${v.id}`}>{t("dash.see_all")}</Link>}</div>
            {alerts.length ? (
              <div className="list">
                {alerts.slice(0, 5).map((a) => <AlertItem key={a.ruleId} r={a} vehicle={vehicles.length > 1 ? v.name : undefined} t={t} fmt={fmt} partName={partLabel({ key: a.partKey, name: a.partName }, lang)} />)}
              </div>
            ) : <div className="card mute">{t("dash.focus_none")}</div>}

            {defects.length > 0 && (
              <>
                <div className="sec"><h2>{t("dash.issues_open")}</h2><Link href="/defects">{t("dash.see_all")}</Link></div>
                <div className="list">
                  {defects.slice(0, 3).map((d) => (
                    <Link key={d.id} href={`/defects/${d.id}`} className="li">
                      <span className={`dotsev ${d.severity}`}><Icon n={sevIcon[d.severity]} s={20} /></span>
                      <div className="grow"><div className="t">{d.title}</div><div className="mute">{fmt.date(d.date)}{d.odo ? ` · ${fmt.dist(d.odo)}` : ""}</div></div>
                    </Link>
                  ))}
                </div>
              </>
            )}
          </section>
        );
      })}

      {vehicles.length > 0 && (
        <>
          <div className="sec"><h2>{t("dash.spend", { total: fmt.money(year) })}</h2><Link href="/compare">{t("dash.action_costs")}</Link></div>
          <div className="card">
            <div className="bars" role="img" aria-label={t("dash.spend_aria", { total: fmt.money(year) })}>
              {series.map((s) => (
                <div key={s.m} title={`${s.m}: ${fmt.money(s.total)}`} className={s.m === curMonth ? "cur" : undefined}>
                  <i style={{ height: `${(s.total / max) * 100}%` }} /><span>{s.m.slice(5)}</span>
                </div>
              ))}
            </div>
            <div className="mute" style={{ marginTop: 10 }}>{t("dash.month_avg", { avg: fmt.money(Math.round(year / 12)) })}</div>
          </div>
        </>
      )}
    </>
  );
}
