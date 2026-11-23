export interface Money {
  sum: number;            // cộng các hạng mục (như in trên phiếu)
  discount: number;       // giảm giá / chiết khấu (số dương)
  vat: number;            // tiền thuế GTGT
  vatIncluded: boolean;   // true: giá các dòng ĐÃ gồm VAT (VAT chỉ để tham khảo); false: VAT cộng thêm bên ngoài
}

/** Tổng phải thanh toán theo các thành phần. */
export const expectedTotal = (m: Money): number => m.sum - m.discount + (m.vatIncluded ? 0 : m.vat);

export function reconcile(m: Money, slipTotal: number | null): { expected: number; diff: number | null; ok: boolean | null } {
  const expected = expectedTotal(m);
  if (slipTotal == null) return { expected, diff: null, ok: null };
  const diff = slipTotal - expected;
  return { expected, diff, ok: Math.abs(diff) <= 1 };
}

const RATES = [5, 8, 10];

/** AI hay bỏ sót VAT: nếu tổng trên phiếu hơn (cộng hàng − giảm giá) đúng 5/8/10% thì suy ra VAT. */
export function inferVat(sum: number, discount: number, vat: number, slipTotal: number | null): { vat: number; rate: number | null; inferred: boolean } {
  if (vat > 0 || slipTotal == null) return { vat, rate: null, inferred: false };
  const base = sum - discount;
  const diff = slipTotal - base;
  if (base <= 0 || diff <= 1) return { vat: 0, rate: null, inferred: false };
  const ratio = diff / base;
  const rate = RATES.find((r) => Math.abs(ratio - r / 100) <= 0.004);
  return rate ? { vat: diff, rate, inferred: true } : { vat: 0, rate: null, inferred: false };
}

/** Hệ số quy giá dòng về giá trước thuế (để so sánh giữa các garage cho công bằng). */
export const netFactor = (rate: number | null, included: boolean): number => (included && rate && rate > 0 ? 1 / (1 + rate / 100) : 1);

export const vatFromRate = (base: number, rate: number): number => Math.round((base * rate) / 100);
