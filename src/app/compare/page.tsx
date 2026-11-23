import Link from "next/link";
import { all } from "../../lib/db.ts";
import { listPartTypes } from "../../lib/queries.ts";
import { getI18n } from "../../lib/settings.ts";
import { partLabel } from "../../lib/parts.ts";
import type { T } from "../../lib/i18n/index.ts";
import type { Fmt } from "../../lib/format.ts";

interface Pt { date: string; garage: string | null; unit: number; vehicle: string }

const pct = (a: number, b: number) => (b ? ((a - b) / b) * 100 : 0);
const Trend = ({ v }: { v: number }) =>
  Math.abs(v) < 0.5 ? <span className="mute">≈ 0%</span>
  : <span className={v > 0 ? "up" : "down"}>{v > 0 ? "▲" : "▼"} {Math.abs(v).toFixed(0)}%</span>;

function Chart({ pts, t, fmt }: { pts: Pt[]; t: T; fmt: Fmt }) {
  if (pts.length < 2) return null;
  const W = 600, H = 160, P = 24;
  const t0 = Date.parse(pts[0].date), t1 = Date.parse(pts[pts.length - 1].date) || t0 + 1;
  const hi = Math.max(...pts.map((p) => p.unit)), lo = Math.min(...pts.map((p) => p.unit));
  const x = (d: string) => P + ((Date.parse(d) - t0) / Math.max(1, t1 - t0)) * (W - 2 * P);
  const y = (u: number) => H - P - ((u - lo) / Math.max(1, hi - lo)) * (H - 2 * P);
  const garages = [...new Set(pts.map((p) => p.garage ?? "—"))];
  const colors = ["#2563eb", "#dc2626", "#16a34a", "#d97706", "#7c3aed", "#0891b2"];
  return (
    <div className="card">
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%" }} role="img" aria-label={t("cmp.chart_aria")}>
        <line x1={P} y1={H - P} x2={W - P} y2={H - P} stroke="currentColor" opacity=".2" />
        <text x={P} y={12} fontSize="10" fill="currentColor" opacity=".6">{fmt.money(hi)}</text>
        <text x={P} y={H - 6} fontSize="10" fill="currentColor" opacity=".6">{fmt.date(pts[0].date)}</text>
        <text x={W - P} y={H - 6} fontSize="10" textAnchor="end" fill="currentColor" opacity=".6">{fmt.date(pts[pts.length - 1].date)}</text>
        <polyline fill="none" stroke="currentColor" opacity=".25" points={pts.map((p) => `${x(p.date)},${y(p.unit)}`).join(" ")} />
        {pts.map((p, i) => (
          <circle key={i} cx={x(p.date)} cy={y(p.unit)} r="5" fill={colors[garages.indexOf(p.garage ?? "—") % colors.length]}>
            <title>{`${fmt.date(p.date)} · ${p.garage ?? "—"} · ${fmt.money(p.unit)}`}</title>
          </circle>
        ))}
      </svg>
      <div className="row mute">{garages.map((g, i) => <span key={g}><span style={{ color: colors[i % colors.length] }}>●</span> {g}</span>)}</div>
    </div>
  );
}

export default async function Compare({ searchParams }: { searchParams: Promise<{ part?: string; kind?: string }> }) {
  const { part, kind = "part" } = await searchParams;
  const { t, fmt, lang } = await getI18n();
  const parts = await listPartTypes();
  const kindSql = kind === "all" ? "" : "AND i.kind = ?";
  const kindArg = kind === "all" ? [] : [kind];

  if (!part) {
    const rows = await all<{ id: number; key: string | null; name: string; category: string; n: number; avg: number; garages: number }>(
      `SELECT p.id, p.key, p.name, p.category, COUNT(*) n, AVG(i.unit_price) avg, COUNT(DISTINCT s.garage_id) garages
       FROM service_items i JOIN part_types p ON p.id = i.part_type_id JOIN service_records s ON s.id = i.record_id
       WHERE i.unit_price > 0 ${kindSql} GROUP BY p.id ORDER BY n DESC`, ...kindArg);
    const byGarage = await all<{ garage: string | null; n: number; total: number }>(
      `SELECT g.name AS garage, COUNT(*) n, SUM(s.total) total FROM service_records s
       LEFT JOIN garages g ON g.id = s.garage_id WHERE s.total > 0 GROUP BY g.id ORDER BY total DESC`);
    return (
      <>
        <h1>{t("cmp.title")}</h1>
        <p className="sub">{t("cmp.sub")}</p>
        {rows.length === 0 ? (
          <div className="card">{t("cmp.empty")}</div>
        ) : (
          <div className="list">
            {rows.map((r) => (
              <Link key={r.id} href={`/compare?part=${r.id}`} className="li">
                <div className="grow"><div className="t">{partLabel(r, lang)}</div><div className="mute">{t("cmp.times_garages", { n: r.n, g: r.garages })}</div></div>
                <div className="r t">{fmt.money(r.avg)}<div className="mute">{t("cmp.avg_price")}</div></div>
              </Link>
            ))}
          </div>
        )}
        {byGarage.length > 0 && (
          <>
            <h2>{t("cmp.by_garage_total")}</h2>
            <div className="list">
              {byGarage.map((g) => (
                <div className="li" key={g.garage ?? "?"}><div className="grow"><div className="t">{g.garage ?? t("cmp.unknown")}</div><div className="mute">{t("cmp.slips_count", { n: g.n })}</div></div><div className="r t">{fmt.money(g.total)}</div></div>
              ))}
            </div>
          </>
        )}
      </>
    );
  }

  const pid = Number(part);
  const pts = await all<Pt>(
    `SELECT s.date, g.name AS garage, i.unit_price AS unit, v.name AS vehicle
     FROM service_items i JOIN service_records s ON s.id = i.record_id
     LEFT JOIN garages g ON g.id = s.garage_id JOIN vehicles v ON v.id = s.vehicle_id
     WHERE i.part_type_id = ? AND i.unit_price > 0 ${kindSql} ORDER BY s.date, s.id`, pid, ...kindArg);
  const found = parts.find((p) => p.id === pid);
  const name = found ? partLabel(found, lang) : "";
  const overall = pts.length ? pts.reduce((a, b) => a + b.unit, 0) / pts.length : 0;
  const gmap = new Map<string, Pt[]>();
  for (const p of pts) gmap.set(p.garage ?? t("cmp.unknown"), [...(gmap.get(p.garage ?? t("cmp.unknown")) ?? []), p]);
  const stats = [...gmap.entries()].map(([g, arr]) => {
    const avg = arr.reduce((a, b) => a + b.unit, 0) / arr.length;
    const last = arr[arr.length - 1], prev = arr[arr.length - 2];
    return { g, n: arr.length, avg, last, trend: prev ? pct(last.unit, prev.unit) : null };
  }).sort((a, b) => a.avg - b.avg);
  const first = pts[0], last = pts[pts.length - 1];
  const kinds: [string, string][] = [["part", t("cmp.kind_part")], ["labor", t("cmp.kind_labor")], ["all", t("cmp.kind_all")]];

  return (
    <>
      <p className="sub"><Link href="/compare" className="back">{t("cmp.all_parts")}</Link></p>
      <h1>{name}</h1>
      <div className="seg" role="group" aria-label={t("cmp.kind_aria")} style={{ margin: "8px 0 16px" }}>
        {kinds.map(([k, l]) => <Link key={k} href={`/compare?part=${pid}&kind=${k}`} aria-current={kind === k}>{l}</Link>)}
      </div>
      {!pts.length ? <div className="card">{t("cmp.no_data")}</div> : (
        <>
          <div className="grid">
            <div className="card"><div className="mute">{t("cmp.avg_unit")}</div><div className="stat">{fmt.money(overall)}</div></div>
            <div className="card"><div className="mute">{t("cmp.latest")}</div><div className="stat">{fmt.money(last.unit)}</div><div className="mute">{fmt.date(last.date)} · {last.garage ?? "—"}</div></div>
            <div className="card"><div className="mute">{t("cmp.trend")}</div><div className="stat"><Trend v={pct(last.unit, first.unit)} /></div><div className="mute">{fmt.money(first.unit)} → {fmt.money(last.unit)}</div></div>
          </div>
          <Chart pts={pts} t={t} fmt={fmt} />
          <h2>{t("cmp.by_garage")}</h2>
          <div className="list">
            {stats.map((s) => {
              const d = pct(s.avg, overall);
              return (
                <div className="li" key={s.g}>
                  <div className="grow">
                    <div className="t">{s.g}</div>
                    <div className="mute">{t("cmp.times_latest", { n: s.n, date: fmt.date(s.last.date) })}{s.trend != null && <Trend v={s.trend} />}</div>
                  </div>
                  <div className="r">
                    <div className="t">{fmt.money(s.avg)}</div>
                    {stats.length > 1 && d > 20 ? <span className="badge b-overdue">{t("cmp.pricier", { pct: d.toFixed(0) })}</span>
                      : stats.length > 1 && d < -10 ? <span className="badge b-ok">{t("cmp.cheaper", { pct: Math.abs(d).toFixed(0) })}</span> : null}
                  </div>
                </div>);
            })}
          </div>
          <h2>{t("cmp.each_time")}</h2>
          <div className="list">
            {[...pts].reverse().map((p, i) => (
              <div className="li" key={i}><div className="grow"><div className="t">{p.garage ?? "—"}</div><div className="mute">{fmt.date(p.date)} · {p.vehicle}</div></div><div className="r t">{fmt.money(p.unit)}</div></div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
