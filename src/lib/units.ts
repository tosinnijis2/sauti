import { ExactDecimal, decimalMoney, type DecimalValue } from "./decimal";

export const UNIT_VALUES = ["ITEM", "KG", "G", "TONNE", "LITRE", "ML", "DOZEN", "BAG", "SACK", "BOX", "CRATE", "BUNDLE"] as const;
export type Unit = typeof UNIT_VALUES[number];
export const PACKAGE_UNITS: readonly Unit[] = ["BAG", "SACK", "BOX", "CRATE", "BUNDLE"];
export const CONTENT_UNITS = ["G", "KG", "TONNE", "ML", "LITRE", "ITEM"] as const;
export const COMPARISON_UNITS = ["KG", "LITRE", "ITEM", "DOZEN", "BAG", "SACK", "BOX", "CRATE", "BUNDLE"] as const;
export type ComparisonUnit = typeof COMPARISON_UNITS[number];
export const UNIT_RULES: Record<Unit, { label: string; base: ComparisonUnit; factor: number }> = {
  ITEM: { label: "item", base: "ITEM", factor: 1 },
  KG: { label: "kg", base: "KG", factor: 1 },
  G: { label: "g", base: "KG", factor: 0.001 },
  TONNE: { label: "tonne", base: "KG", factor: 1000 },
  LITRE: { label: "litre", base: "LITRE", factor: 1 },
  ML: { label: "ml", base: "LITRE", factor: 0.001 },
  DOZEN: { label: "dozen", base: "DOZEN", factor: 1 },
  BAG: { label: "bag", base: "BAG", factor: 1 },
  SACK: { label: "sack", base: "SACK", factor: 1 },
  BOX: { label: "box", base: "BOX", factor: 1 },
  CRATE: { label: "crate", base: "CRATE", factor: 1 },
  BUNDLE: { label: "bundle", base: "BUNDLE", factor: 1 },
};
export const STATUS_VALUES = ["ACTIVE", "RESERVED", "SOLD", "INACTIVE"] as const;
export type Status = typeof STATUS_VALUES[number];
export const STATUS_LABELS: Record<Status, string> = { ACTIVE: "Active", RESERVED: "Reserved", SOLD: "Sold", INACTIVE: "Inactive" };

export function quantityLabel(quantity: DecimalValue, unit: Unit) {
  const plural = !new ExactDecimal(quantity.toString()).eq(1) && !["KG", "G", "ML"].includes(unit);
  return `${quantity.toString()} ${UNIT_RULES[unit].label}${plural ? "s" : ""}`;
}
export function normalizedPrice(price: DecimalValue, quantity: DecimalValue | null | undefined, unit: Unit | null | undefined, packageQuantity?: DecimalValue | null, packageUnit?: Unit | null) {
  if (quantity == null || !unit || !UNIT_VALUES.includes(unit)) return null;
  try {
    let amount = new ExactDecimal(quantity.toString());
    const total = new ExactDecimal(price.toString());
    if (!amount.isFinite() || amount.lte(0) || !total.isFinite() || total.lte(0)) return null;
    let measuredUnit = unit;
    if (packageQuantity != null || packageUnit != null) {
      if (packageQuantity == null || !packageUnit || !PACKAGE_UNITS.includes(unit) || !CONTENT_UNITS.some(value => value === packageUnit)) return null;
      const contents = new ExactDecimal(packageQuantity.toString());
      if (!contents.isFinite() || contents.lte(0)) return null;
      amount = amount.mul(contents);
      measuredUnit = packageUnit;
    }
    amount = amount.mul(UNIT_RULES[measuredUnit].factor.toString());
    return { price: total.div(amount), unit: UNIT_RULES[measuredUnit].base, quantity: amount };
  } catch { return null; }
}

export function formatUnitPrice(value: DecimalValue) {
  return decimalMoney(value);
}
