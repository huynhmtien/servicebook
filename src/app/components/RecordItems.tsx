"use client";
import { useState } from "react";
import Icon from "./Icon";
import { guessPart } from "../../lib/parts.ts";
import { expectedTotal, reconcile, vatFromRate } from "../../lib/money.ts";

export interface Part { id: number; name: string; category: string; kw: string[] }
export interface ItemInit {
  raw_name: string; qty: number; amount: number; kind: string; part_type_id: number | null;
  how?: "memory" | "ai" | "keyword" | null; confidence?: number | null;
}
export interface MoneyInit { slipTotal?: number | null; discount?: number; vat?: number; vatRate?: number | null; vatIncluded?: boolean; vatInferred?: boolean }

type Hint = "memory" | "ai" | "keyword" | "low" | "";
interface Row { key: number; name: string; part: string; kind: string; qty: string; amount: string; hint: Hint }

const money = (n: number) => new Intl.NumberFormat("vi-VN").format(Math.round(n)) + " ₫";
const toNum = (s: string) => Number(String(s).replace(/[.,\s]/g, "")) || 0;
let seq = 0;
const blankRow = (): Row => ({ key: ++seq, name: "", part: "", kind: "part", qty: "1", amount: "", hint: "" });

const HINT_TEXT: Record<Exclude<Hint, "">, { text: string; cls: string }> = {
  memory: { text: "Theo lần anh đã xác nhận", cls: "b-ok" },
  ai: { text: "AI phân loại", cls: "b-unknown" },
  keyword: { text: "Gợi ý theo từ khóa — kiểm tra", cls: "b-soon" },
  low: { text: "AI chưa chắc — kiểm tra", cls: "b-soon" },
};

/** Danh sách hạng mục + phần tiền (giảm giá, VAT, tổng). Tổng cập nhật ngay khi sửa/xóa dòng. */
export default function RecordItems({ parts, initial, blank, money: m0 = {} }: { parts: Part[]; initial: ItemInit[]; blank: number; money?: MoneyInit }) {
  const [rows, setRows] = useState<Row[]>(() => [
    ...initial.map((i): Row => ({
      key: ++seq, name: i.raw_name, part: i.part_type_id ? String(i.part_type_id) : "", kind: i.kind, qty: String(i.qty), amount: String(i.amount || ""),
      hint: i.how === "memory" ? "memory" : i.how === "keyword" ? "keyword" : i.how === "ai" ? ((i.confidence ?? 1) < 0.6 ? "low" : "ai") : "",
    })),
    ...Array.from({ length: blank }, blankRow),
  ]);
  const [discount, setDiscount] = useState(String(m0.discount || ""));
  const [mode, setMode] = useState<"none" | "out" | "in">(m0.vat ? (m0.vatIncluded ? "in" : "out") : "none");
  const [rate, setRate] = useState(m0.vatRate ? String(m0.vatRate) : "");
  const [vatTyped, setVatTyped] = useState<string | null>(m0.vat && !m0.vatRate ? String(m0.vat) : null);

  const groups = [...new Set(parts.map((p) => p.category))];
  const set = (key: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const filled = rows.filter((r) => r.name.trim());
  const sum = filled.reduce((a, r) => a + toNum(r.amount), 0);
  const disc = toNum(discount);
  const base = Math.max(0, sum - disc);
  const rateN = Number(String(rate).replace(",", ".")) || 0;
  // có thuế suất và chưa tự gõ tiền VAT → tự tính lại khi thêm/xóa dòng
  const vatAuto = mode === "in" ? Math.round((base * rateN) / (100 + rateN)) : vatFromRate(base, rateN);
  const vat = mode === "none" ? 0 : vatTyped != null ? toNum(vatTyped) : rateN > 0 ? vatAuto : 0;
  const total = expectedTotal({ sum, discount: disc, vat, vatIncluded: mode === "in" });
  const rec = reconcile({ sum, discount: disc, vat, vatIncluded: mode === "in" }, m0.slipTotal ?? null);
  const partSum = filled.filter((r) => r.kind === "part").reduce((a, r) => a + toNum(r.amount), 0);
  const laborSum = filled.filter((r) => r.kind === "labor").reduce((a, r) => a + toNum(r.amount), 0);
  const unmapped = filled.filter((r) => !r.part).length;

  const suggest = (r: Row) => {
    if (r.part || !r.name.trim()) return;
    const id = guessPart(r.name, parts.map((p) => ({ id: p.id, kw: p.kw })));
    if (id) set(r.key, { part: String(id), hint: "keyword" });
  };

  return (
    <>
      {rows.map((r, i) => {
        const h = r.hint ? HINT_TEXT[r.hint] : null;
        return (
          <div className="item" key={r.key}>
            <div className="full row" style={{ justifyContent: "space-between", flexWrap: "nowrap" }}>
              <label htmlFor={`name_${i}`} style={{ margin: 0 }}>Hạng mục {i + 1}</label>
              <button type="button" className="danger" style={{ minHeight: 36, padding: "4px 12px" }}
                onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))} aria-label={`Xóa hạng mục ${i + 1}`}>
                Xóa
              </button>
            </div>
            <div className="full"><input id={`name_${i}`} name={`name_${i}`} value={r.name} onChange={(e) => set(r.key, { name: e.target.value })}
              onBlur={() => suggest(r)} placeholder="Tên đúng như trên phiếu" /></div>
            <div className="full">
              <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 6, marginBottom: 4 }}>
                <label htmlFor={`part_${i}`} style={{ margin: 0 }}>Thuộc linh kiện</label>
                {r.name.trim() && !r.part && <span className="badge b-soon"><Icon n="alert" s={13} />Chưa phân loại</span>}
                {r.part && h && <span className={`badge ${h.cls}`}>{h.text}</span>}
              </div>
              <select id={`part_${i}`} name={`part_${i}`} value={r.part} onChange={(e) => set(r.key, { part: e.target.value, hint: "" })}>
                <option value="">— chưa phân loại —</option>
                {groups.map((g) => (
                  <optgroup key={g} label={g}>
                    {parts.filter((p) => p.category === g).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </optgroup>
                ))}
              </select>
            </div>
            <div><label htmlFor={`kind_${i}`}>Loại</label>
              <select id={`kind_${i}`} name={`kind_${i}`} value={r.kind} onChange={(e) => set(r.key, { kind: e.target.value })}>
                <option value="part">Vật tư</option><option value="labor">Tiền công</option></select></div>
            <div><label htmlFor={`qty_${i}`}>Số lượng</label>
              <input id={`qty_${i}`} name={`qty_${i}`} value={r.qty} inputMode="decimal" onChange={(e) => set(r.key, { qty: e.target.value })} /></div>
            <div className="amt"><label htmlFor={`amount_${i}`}>Thành tiền (₫)</label>
              <input id={`amount_${i}`} name={`amount_${i}`} value={r.amount} inputMode="numeric" onChange={(e) => set(r.key, { amount: e.target.value })} /></div>
          </div>
        );
      })}
      <button type="button" className="btn ghost block" onClick={() => setRows((rs) => [...rs, blankRow()])}>
        <Icon n="plus" s={20} /> Thêm hạng mục
      </button>
      {unmapped > 0 && <p className="mute" style={{ marginTop: 10 }}>{unmapped} dòng chưa phân loại — vẫn lưu được và tính vào chi phí, nhưng không tính tuổi thọ linh kiện.</p>}

      <h2>Thanh toán</h2>
      <div className="card" id="money">
        <div className="row" style={{ justifyContent: "space-between" }}><span>Cộng các hạng mục</span><b>{money(sum)}</b></div>
        <div className="mute" style={{ textAlign: "right" }}>Vật tư {money(partSum)} · Tiền công {money(laborSum)}</div>

        <div className="form" style={{ marginTop: 14 }}>
          <div className="field"><label htmlFor="discount">Giảm giá / chiết khấu (₫)</label>
            <input id="discount" name="discount" inputMode="numeric" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="0" /></div>
          <div className="field"><label htmlFor="vat_mode">Thuế VAT trên phiếu</label>
            <select id="vat_mode" value={mode} onChange={(e) => { setMode(e.target.value as "none" | "out" | "in"); setVatTyped(null); }}>
              <option value="none">Không có VAT</option>
              <option value="out">VAT cộng thêm (ngoài giá các dòng)</option>
              <option value="in">Giá các dòng đã gồm VAT</option>
            </select></div>
          {mode !== "none" && (
            <>
              <div className="field"><label htmlFor="vat_rate">Thuế suất (%)</label>
                <input id="vat_rate" name="vat_rate" inputMode="decimal" list="rates" value={rate} onChange={(e) => { setRate(e.target.value); setVatTyped(null); }} placeholder="8 hoặc 10" />
                <datalist id="rates"><option value="5" /><option value="8" /><option value="10" /></datalist></div>
              <div className="field"><label htmlFor="vat">Tiền VAT (₫)</label>
                <input id="vat" name="vat" inputMode="numeric" value={vatTyped ?? (vat ? String(vat) : "")} onChange={(e) => setVatTyped(e.target.value)} placeholder="0" /></div>
            </>
          )}
        </div>
        <input type="hidden" name="vat_included" value={mode === "in" ? "1" : "0"} />
        {mode === "none" && <><input type="hidden" name="vat" value="0" /><input type="hidden" name="vat_rate" value="" /></>}
        {m0.vatInferred && <p className="mute" style={{ marginBottom: 0 }}>App tự suy ra VAT {m0.vatRate}% từ chênh lệch giữa tổng trên phiếu và cộng hàng — anh đối chiếu với ảnh phiếu.</p>}

        <div className="row" style={{ justifyContent: "space-between", marginTop: 14, borderTop: ".5px solid var(--line)", paddingTop: 12 }}>
          <span style={{ fontWeight: 600 }}>Tổng thanh toán</span><b style={{ fontSize: 22 }}>{money(total)}</b>
        </div>
        {m0.slipTotal != null && (
          <div style={{ marginTop: 6 }} role="status">
            <span className="mute">Tổng trên phiếu: {money(m0.slipTotal)} </span>
            <span className={`badge ${rec.ok ? "b-ok" : "b-soon"}`}>{rec.ok ? "Khớp" : `Lệch ${money(Math.abs(rec.diff ?? 0))}`}</span>
            {!rec.ok && <div className="mute" style={{ marginTop: 4 }}>
              {(rec.diff ?? 0) > 0 ? "Phiếu cao hơn: có thể thiếu dòng, thiếu VAT hoặc đã đọc sai số." : "Cộng của anh cao hơn phiếu: có thể thừa dòng hoặc thiếu giảm giá."}
            </div>}
          </div>
        )}
      </div>
    </>
  );
}
