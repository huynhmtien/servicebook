export interface Money {
  sum: number;            // sum of the items (as printed on the record)
  discount: number;       // discount / rebate (positive number)
  vat: number;            // VAT amount
  vatIncluded: boolean;   // true: line prices ALREADY include VAT (VAT is for reference only); false: VAT is added on top
}

/** Total payable from the components. */
export const expectedTotal = (m: Money): number => m.sum - m.discount + (m.vatIncluded ? 0 : m.vat);

export function reconcile(m: Money, slipTotal: number | null): { expected: number; diff: number | null; ok: boolean | null } {
  const expected = expectedTotal(m);
  if (slipTotal == null) return { expected, diff: null, ok: null };
  const diff = slipTotal - expected;
  return { expected, diff, ok: Math.abs(diff) <= 1 };
}

const DEFAULT_RATES = [5, 8, 10];

/** The AI often misses tax: if the record's total exceeds (sum of lines − discount) by exactly a common tax rate, infer the tax. */
export function inferVat(sum: number, discount: number, vat: number, slipTotal: number | null, rates: number[] = DEFAULT_RATES): { vat: number; rate: number | null; inferred: boolean } {
  if (vat > 0 || slipTotal == null) return { vat, rate: null, inferred: false };
  const base = sum - discount;
  const diff = slipTotal - base;
  if (base <= 0 || diff <= 1) return { vat: 0, rate: null, inferred: false };
  const ratio = diff / base;
  const rate = rates.find((r) => Math.abs(ratio - r / 100) <= 0.004);
  return rate ? { vat: diff, rate, inferred: true } : { vat: 0, rate: null, inferred: false };
}

/** Factor to convert a line price to pre-tax price (so garages can be compared fairly). */
export const netFactor = (rate: number | null, included: boolean): number => (included && rate && rate > 0 ? 1 / (1 + rate / 100) : 1);

export const vatFromRate = (base: number, rate: number): number => Math.round((base * rate) / 100);
