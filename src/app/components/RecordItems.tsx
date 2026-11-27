"use client";
import { useState } from "react";
import Icon from "./Icon";
import { guessPart, CATEGORIES, COST_ONLY, type Category } from "../../lib/parts-core.ts";
import { createPart } from "../actions";
import { expectedTotal, reconcile, vatFromRate } from "../../lib/money.ts";
import { useI18n } from "./I18nProvider";

export interface Part { id: number; name: string; category: string; kw: string[] }
export interface ItemInit {
  raw_name: string; qty: number; amount: number; kind: string; part_type_id: number | null;
  how?: "memory" | "ai" | "keyword" | null; confidence?: number | null; new_part?: { name: string; category: string } | null;
}
export interface MoneyInit { slipTotal?: number | null; discount?: number; vat?: number; vatRate?: number | null; vatIncluded?: boolean; vatInferred?: boolean }

type Hint = "memory" | "ai" | "keyword" | "low" | "";
interface Row { key: number; name: string; part: string; kind: string; qty: string; amount: string; hint: Hint; suggest: { name: string; category: string } | null }
interface NewForm { key: number; name: string; cat: string; km: string; mo: string; busy: boolean; err: string }

let seq = 0;
const blankRow = (): Row => ({ key: ++seq, name: "", part: "", kind: "part", qty: "1", amount: "", hint: "", suggest: null });

const HINT_CLS: Record<Exclude<Hint, "">, string> = { memory: "b-ok", ai: "b-unknown", keyword: "b-soon", low: "b-soon" };

/** Item list + money section (discount, tax, total). The total updates immediately when a row is edited/removed. `amount` is stored in the smallest unit of the currency. */
export default function RecordItems({ parts: baseParts, initial, blank, money: m0 = {} }: { parts: Part[]; initial: ItemInit[]; blank: number; money?: MoneyInit }) {
  const { t, fmt } = useI18n();
  const money = fmt.money, toNum = fmt.parse;
  const [extra, setExtra] = useState<Part[]>([]); // parts created from this form
  // a part created here also arrives with the refreshed server list: show each id once
  const parts = [...baseParts, ...extra.filter((e) => !baseParts.some((b) => b.id === e.id))];
  const [nf, setNf] = useState<NewForm | null>(null);
  const [rows, setRows] = useState<Row[]>(() => [
    ...initial.map((i): Row => ({
      key: ++seq, name: i.raw_name, part: i.part_type_id ? String(i.part_type_id) : "", kind: i.kind, qty: String(i.qty), amount: fmt.amountInput(i.amount),
      suggest: i.part_type_id ? null : i.new_part ?? null,
      hint: i.how === "memory" ? "memory" : i.how === "keyword" ? "keyword" : i.how === "ai" ? ((i.confidence ?? 1) < 0.6 ? "low" : "ai") : "",
    })),
    ...Array.from({ length: blank }, blankRow),
  ]);
  const [discount, setDiscount] = useState(fmt.amountInput(m0.discount));
  const [mode, setMode] = useState<"none" | "out" | "in">(m0.vat ? (m0.vatIncluded ? "in" : "out") : "none");
  const [rate, setRate] = useState(m0.vatRate ? String(m0.vatRate) : "");
  const [vatTyped, setVatTyped] = useState<string | null>(m0.vat && !m0.vatRate ? fmt.amountInput(m0.vat) : null);

  const groups = CATEGORIES.filter((c) => parts.some((p) => p.category === c));
  const set = (key: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const filled = rows.filter((r) => r.name.trim());
  const sum = filled.reduce((a, r) => a + toNum(r.amount), 0);
  const disc = toNum(discount);
  const base = Math.max(0, sum - disc);
  const rateN = Number(String(rate).replace(",", ".")) || 0;
  // has a tax rate and the tax amount wasn't typed manually → recompute when rows are added/removed
  const vatAuto = mode === "in" ? Math.round((base * rateN) / (100 + rateN)) : vatFromRate(base, rateN);
  const vat = mode === "none" ? 0 : vatTyped != null ? toNum(vatTyped) : rateN > 0 ? vatAuto : 0;
  const total = expectedTotal({ sum, discount: disc, vat, vatIncluded: mode === "in" });
  const rec = reconcile({ sum, discount: disc, vat, vatIncluded: mode === "in" }, m0.slipTotal ?? null);
  const partSum = filled.filter((r) => r.kind === "part").reduce((a, r) => a + toNum(r.amount), 0);
  const laborSum = filled.filter((r) => r.kind === "labor").reduce((a, r) => a + toNum(r.amount), 0);
  const unmapped = filled.filter((r) => !r.part).length;

  /** Create a catalog part (server) and select it on this row — and on other rows the AI proposed the same new part for. */
  const makePart = async (rowKey: number, name: string, category: string, km = "", mo = "") => {
    const res = await createPart({ name, category, km: km ? Number(fmt.parse(km)) : null, months: mo ? Number(mo.replace(/\D/g, "")) : null });
    if ("error" in res) return res.error;
    setExtra((x) => (x.some((p) => p.id === res.id) || baseParts.some((p) => p.id === res.id) ? x : [...x, res]));
    const norm = name.trim().toLowerCase();
    setRows((rs) => rs.map((r) => (r.key === rowKey || (!r.part && r.suggest && r.suggest.name.trim().toLowerCase() === norm) ? { ...r, part: String(res.id), hint: "", suggest: null } : r)));
    return null;
  };
  const suggest = (r: Row) => {
    if (r.part || !r.name.trim()) return;
    const id = guessPart(r.name, parts.map((p) => ({ id: p.id, kw: p.kw })));
    if (id) set(r.key, { part: String(id), hint: "keyword" });
  };

  return (
    <>
      {rows.map((r, i) => {
        const hintCls = r.hint ? HINT_CLS[r.hint] : null;
        return (
          <div className="item" key={r.key}>
            <div className="full row" style={{ justifyContent: "space-between", flexWrap: "nowrap" }}>
              <label htmlFor={`name_${i}`} style={{ margin: 0 }}>{t("items.item_n", { n: i + 1 })}</label>
              <button type="button" className="danger" style={{ minHeight: 44, padding: "4px 14px" }}
                onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))} aria-label={t("items.remove_aria", { n: i + 1 })}>
                {t("items.remove")}
              </button>
            </div>
            <div className="full"><input id={`name_${i}`} name={`name_${i}`} value={r.name} onChange={(e) => set(r.key, { name: e.target.value })}
              onBlur={() => suggest(r)} placeholder={t("items.name_ph")} /></div>
            <div className="full">
              <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 6, marginBottom: 4 }}>
                <label htmlFor={`part_${i}`} style={{ margin: 0 }}>{t("items.part")}</label>
                {r.name.trim() && !r.part && <span className="badge b-soon"><Icon n="alert" s={13} />{t("items.unclassified_badge")}</span>}
                {r.part && hintCls && r.hint && <span className={`badge ${hintCls}`}>{t(`hint.${r.hint}` as const)}</span>}
              </div>
              <select id={`part_${i}`} name={`part_${i}`} value={r.part} onChange={(e) => {
                if (e.target.value === "__new__") { setNf({ key: r.key, name: r.suggest?.name ?? r.name.trim().slice(0, 60), cat: r.suggest?.category ?? "drivetrain", km: "", mo: "", busy: false, err: "" }); return; }
                set(r.key, { part: e.target.value, hint: "" });
              }}>
                <option value="">{t("items.unclassified_opt")}</option>
                {groups.map((g) => (
                  <optgroup key={g} label={t(`cat.${g as Category}`)}>
                    {parts.filter((p) => p.category === g).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </optgroup>
                ))}
                <option value="__new__">{t("items.new_opt")}</option>
              </select>
              {!r.part && r.suggest && nf?.key !== r.key && (
                <button type="button" className="btn ghost block" style={{ marginTop: 8, minHeight: 44, fontSize: 15, textAlign: "left", justifyContent: "flex-start" }}
                  onClick={async () => { const e = await makePart(r.key, r.suggest!.name, r.suggest!.category); if (e) setNf({ key: r.key, name: r.suggest!.name, cat: r.suggest!.category, km: "", mo: "", busy: false, err: t("items.new_err") }); }}>
                  <Icon n="plus" s={18} /> {t("items.new_ai", { name: r.suggest.name, cat: t(`cat.${r.suggest.category as Category}`) })}
                </button>
              )}
              {nf?.key === r.key && (
                <div className="newpart" role="group" aria-label={t("items.new_title")}>
                  <b>{t("items.new_title")}</b>
                  <div className="field"><label htmlFor={`np_name_${i}`}>{t("items.new_name")}</label>
                    <input id={`np_name_${i}`} value={nf.name} maxLength={60} onChange={(e) => setNf({ ...nf, name: e.target.value })} placeholder={t("items.new_name_ph")} /></div>
                  <div className="field"><label htmlFor={`np_cat_${i}`}>{t("items.new_cat")}</label>
                    <select id={`np_cat_${i}`} value={nf.cat} onChange={(e) => setNf({ ...nf, cat: e.target.value })}>
                      {CATEGORIES.map((c) => <option key={c} value={c}>{t(`cat.${c}`)}{c === COST_ONLY ? ` — ${t("items.new_cat_nocheck")}` : ""}</option>)}
                    </select></div>
                  {nf.cat !== COST_ONLY && (
                    <div className="row" style={{ gap: 10, flexWrap: "nowrap" }}>
                      <div className="field" style={{ flex: 1 }}><label htmlFor={`np_km_${i}`}>{t("items.new_km", { unit: fmt.unit })}</label>
                        <input id={`np_km_${i}`} inputMode="numeric" value={nf.km} onChange={(e) => setNf({ ...nf, km: e.target.value })} /></div>
                      <div className="field" style={{ flex: 1 }}><label htmlFor={`np_mo_${i}`}>{t("items.new_months")}</label>
                        <input id={`np_mo_${i}`} inputMode="numeric" value={nf.mo} onChange={(e) => setNf({ ...nf, mo: e.target.value })} /></div>
                    </div>
                  )}
                  <p className="mute" style={{ margin: 0 }}>{t("items.new_hint")}</p>
                  {nf.err && <div className="flash" role="alert" style={{ marginBottom: 0 }}>{nf.err}</div>}
                  <div className="row" style={{ gap: 10, flexWrap: "nowrap" }}>
                    <button type="button" className="btn primary" style={{ flex: 1 }} disabled={nf.busy || nf.name.trim().length < 2}
                      onClick={async () => { setNf({ ...nf, busy: true, err: "" }); const e = await makePart(nf.key, nf.name, nf.cat, nf.km, nf.mo); setNf(e ? { ...nf, busy: false, err: t("items.new_err") } : null); }}>
                      {nf.busy ? t("items.new_busy") : t("items.new_create")}
                    </button>
                    <button type="button" className="btn ghost" onClick={() => setNf(null)}>{t("items.new_cancel")}</button>
                  </div>
                </div>
              )}
            </div>
            <div><label htmlFor={`kind_${i}`}>{t("items.kind")}</label>
              <select id={`kind_${i}`} name={`kind_${i}`} value={r.kind} onChange={(e) => set(r.key, { kind: e.target.value })}>
                <option value="part">{t("items.kind_part")}</option><option value="labor">{t("items.kind_labor")}</option></select></div>
            <div><label htmlFor={`qty_${i}`}>{t("items.qty")}</label>
              <input id={`qty_${i}`} name={`qty_${i}`} value={r.qty} inputMode="decimal" onChange={(e) => set(r.key, { qty: e.target.value })} /></div>
            <div className="amt"><label htmlFor={`amount_${i}`}>{t("items.amount", { currency: fmt.currency })}</label>
              <input id={`amount_${i}`} name={`amount_${i}`} value={r.amount} inputMode="decimal" onChange={(e) => set(r.key, { amount: e.target.value })} /></div>
          </div>
        );
      })}
      <button type="button" className="btn ghost block" onClick={() => setRows((rs) => [...rs, blankRow()])}>
        <Icon n="plus" s={20} /> {t("items.add")}
      </button>
      {unmapped > 0 && <p className="mute" style={{ marginTop: 10 }}>{t("items.unmapped", { count: unmapped })}</p>}

      <h2>{t("pay.title")}</h2>
      <div className="card" id="money">
        <div className="row" style={{ justifyContent: "space-between" }}><span>{t("pay.items_sum")}</span><b>{money(sum)}</b></div>
        <div className="mute" style={{ textAlign: "right" }}>{t("pay.parts_labor", { parts: money(partSum), labor: money(laborSum) })}</div>

        <div className="form cols" style={{ marginTop: 14 }}>
          <div className="field"><label htmlFor="discount">{t("pay.discount", { currency: fmt.currency })}</label>
            <input id="discount" name="discount" inputMode="decimal" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="0" /></div>
          <div className="field"><label htmlFor="vat_mode">{t("pay.tax_mode", { label: fmt.taxLabel })}</label>
            <select id="vat_mode" value={mode} onChange={(e) => { setMode(e.target.value as "none" | "out" | "in"); setVatTyped(null); }}>
              <option value="none">{t("pay.tax_none")}</option>
              <option value="out">{t("pay.tax_out")}</option>
              <option value="in">{t("pay.tax_in")}</option>
            </select></div>
          {mode !== "none" && (
            <>
              <div className="field"><label htmlFor="vat_rate">{t("pay.rate")}</label>
                <input id="vat_rate" name="vat_rate" inputMode="decimal" list="rates" value={rate} onChange={(e) => { setRate(e.target.value); setVatTyped(null); }} placeholder={t("pay.rate_ph")} />
                <datalist id="rates">{[5, 7, 8, 10, 15, 20].map((r) => <option key={r} value={r} />)}</datalist></div>
              <div className="field"><label htmlFor="vat">{t("pay.tax_amount", { currency: fmt.currency })}</label>
                <input id="vat" name="vat" inputMode="decimal" value={vatTyped ?? (vat ? fmt.amountInput(vat) : "")} onChange={(e) => setVatTyped(e.target.value)} placeholder="0" /></div>
            </>
          )}
        </div>
        <input type="hidden" name="vat_included" value={mode === "in" ? "1" : "0"} />
        {mode === "none" && <><input type="hidden" name="vat" value="0" /><input type="hidden" name="vat_rate" value="" /></>}
        {m0.vatInferred && <p className="mute" style={{ marginBottom: 0 }}>{t("pay.inferred", { rate: m0.vatRate ?? 0 })}</p>}

        <div className="row" style={{ justifyContent: "space-between", marginTop: 14, borderTop: ".5px solid var(--line)", paddingTop: 12 }}>
          <span style={{ fontWeight: 600 }}>{t("pay.total")}</span><b style={{ fontSize: 22 }}>{money(total)}</b>
        </div>
        {m0.slipTotal != null && (
          <div style={{ marginTop: 6 }} role="status">
            <span className="mute">{t("pay.slip_total", { amount: money(m0.slipTotal) })}</span>
            <span className={`badge ${rec.ok ? "b-ok" : "b-soon"}`}>{rec.ok ? t("pay.match") : t("pay.mismatch", { amount: money(Math.abs(rec.diff ?? 0)) })}</span>
            {!rec.ok && <div className="mute" style={{ marginTop: 4 }}>
              {(rec.diff ?? 0) > 0 ? t("pay.slip_higher") : t("pay.slip_lower")}
            </div>}
          </div>
        )}
      </div>
    </>
  );
}
