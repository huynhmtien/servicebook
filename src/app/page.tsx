import Link from "next/link";
import { all, get } from "../lib/db.ts";
import { listVehicles, vehicleRules, vehicleAvgKmPerDay } from "../lib/queries.ts";
import { telegramConfigured } from "../lib/telegram.ts";
import { INITIAL_NOTE, addMonths, today } from "../lib/util.ts";
import { getI18n } from "../lib/settings.ts";
import { partLabel } from "../lib/parts.ts";
import { AlertItem, Flash } from "./components/ui";
import Icon from "./components/Icon";
import { updateOdo } from "./actions";

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { ok, error } = await searchParams;
  const { t, fmt, lang, settings } = await getI18n();
  const vehicles = await listVehicles();
  const data = await Promise.all(vehicles.map(async (v) => {
    const rules = (await vehicleRules(v.id)).filter((r) => r.enabled);
    const alerts = rules.filter((r) => r.status === "overdue" || r.status === "soon").sort((a, b) => a.urgency - b.urgency);
    return { v, rules, alerts, avg: await vehicleAvgKmPerDay(v.id) };
  }));
  const overdue = data.flatMap((d) => d.alerts.filter((a) => a.status === "overdue").map((a) => ({ a, v: d.v })));
  const soon = data.flatMap((d) => d.alerts.filter((a) => a.status === "soon").map((a) => ({ a, v: d.v })));
  const known = data.reduce((n, d) => n + d.rules.filter((r) => r.status !== "unknown").length, 0);
  const unknown = data.reduce((n, d) => n + d.rules.filter((r) => r.status === "unknown" && (r.intervalKm != null || r.intervalMonths != null)).length, 0);
  const realRecords = (await get<{ n: number }>("SELECT COUNT(*) AS n FROM service_records WHERE COALESCE(note,'') <> ?", INITIAL_NOTE))?.n ?? 0;

  const steps = [
    { t: t("dash.step_prefs"), href: "/settings", done: settings.confirmed },
    { t: t("dash.step_vehicle"), href: "/vehicles", done: vehicles.length > 0 },
    { t: t("dash.step_setup"), href: vehicles[0] ? `/vehicles/${vehicles[0].id}/setup` : "/vehicles", done: known > 0 },
    { t: t("dash.step_slip"), href: "/records/new", done: realRecords > 0 },
    { t: t("dash.step_telegram"), href: "/settings", done: telegramConfigured() },
  ];
  const onboarding = steps.some((s) => !s.done);

  const todayStr = today();
  const from = addMonths(todayStr.slice(0, 8) + "01", -11);
  const monthly = await all<{ m: string; total: number }>(
    "SELECT substr(date,1,7) AS m, SUM(total) AS total FROM service_records WHERE date >= ? GROUP BY m", from,
  );
  const series = Array.from({ length: 12 }, (_, i) => addMonths(from, i).slice(0, 7)).map((m) => ({ m, total: monthly.find((x) => x.m === m)?.total ?? 0 }));
  const max = Math.max(1, ...series.map((s) => s.total));
  const year = series.reduce((a, b) => a + b.total, 0);

  const heroKind = overdue.length ? "bad" : soon.length ? "warn" : "good";
  const heroText = overdue.length
    ? `${t("dash.hero_overdue", { count: overdue.length })}${soon.length ? t("dash.hero_soon_extra", { count: soon.length }) : ""}`
    : soon.length ? t("dash.hero_soon", { count: soon.length }) : t("dash.hero_ok");

  return (
    <>
      <div className="titlebar"><h1>{t("dash.title")}</h1><Link href="/settings" className="icon-btn" aria-label={t("common.settings")}><Icon n="gear" s={24} /></Link></div>

      <Flash text={error} />
      <Flash text={ok} ok />

      {onboarding && (
        <div className="card">
          <b>{t("dash.quickstart")}</b>
          <div className="steps" style={{ marginTop: 12 }}>
            {steps.map((s, i) => (
              <div key={i} className={`step${s.done ? " done" : ""}`}>
                <span className="n">{s.done ? <Icon n="check" s={16} /> : i + 1}</span>
                {s.done ? <span className="t">{s.t}</span> : <Link href={s.href} className="t">{s.t}</Link>}
              </div>
            ))}
          </div>
        </div>
      )}

      {vehicles.length > 0 && (
        <>
          <div className={`hero ${heroKind}`}>
            <Icon n={heroKind === "good" ? "check" : heroKind === "warn" ? "clock" : "alert"} s={30} />
            <div>
              <div className="big">{heroText}</div>
              {unknown > 0 && heroKind === "good" && <div style={{ fontSize: 14 }}>{t("dash.unknown_hint", { count: unknown })}<Link href={`/vehicles/${vehicles[0].id}/setup`}>{t("dash.unknown_link")}</Link></div>}
            </div>
          </div>

          {overdue.length + soon.length > 0 && (
            <div className="list">
              {[...overdue, ...soon].map(({ a, v }) => <AlertItem key={a.ruleId} r={a} vehicle={vehicles.length > 1 ? v.name : undefined} t={t} fmt={fmt} partName={partLabel({ key: a.partKey, name: a.partName }, lang)} />)}
            </div>
          )}

          <h2>{t("dash.your_vehicles")}</h2>
          <div className="grid">
            {data.map(({ v, alerts, avg }) => (
              <div className="card" key={v.id}>
                <div className="row"><b style={{ fontSize: 18 }}>{v.name}</b><span className="sp" /><span className="mute">{v.plate}</span></div>
                <div className="stat">{fmt.dist(v.odo)}</div>
                <div className="mute">{t("dash.per_day", { n: fmt.num(avg), unit: fmt.unit })}{alerts.length ? t("dash.alerts_count", { count: alerts.length }) : ""}</div>
                <form action={updateOdo} className="row" style={{ marginTop: 12, flexWrap: "nowrap" }}>
                  <input type="hidden" name="vehicle_id" value={v.id} />
                  <input type="hidden" name="back" value="/" />
                  <input name="km" inputMode="numeric" placeholder={t("dash.odo_placeholder")} aria-label={t("dash.odo_aria")} style={{ flex: 1, minWidth: 0 }} required />
                  <button type="submit">{t("common.update")}</button>
                </form>
              </div>
            ))}
          </div>

          <h2>{t("dash.spend", { total: fmt.money(year) })}</h2>
          <div className="card">
            <div className="bars" role="img" aria-label={t("dash.spend_aria", { total: fmt.money(year) })}>
              {series.map((s) => (
                <div key={s.m} title={`${s.m}: ${fmt.money(s.total)}`}>
                  <i style={{ height: `${(s.total / max) * 100}%` }} /><span>{s.m.slice(5)}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );
}
