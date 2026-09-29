import { Decimal } from "@prisma/client/runtime/index-browser";

// Isolate arithmetic precision from Prisma's shared Decimal defaults.
export const ExactDecimal = Decimal.clone({ precision: 60, rounding: Decimal.ROUND_HALF_UP });
export type DecimalValue = { toString(): string };

export function decimalMoney(value: DecimalValue, places = 6) {
  const amount = new ExactDecimal(value.toString());
  if (amount.gt(0) && amount.lt(new ExactDecimal(10).pow(-places))) return `<$${new ExactDecimal(10).pow(-places).toFixed(places)}`;
  const [whole, fraction] = amount.toFixed(places).split(".");
  const cents = (fraction ?? "").replace(/0+$/, "").padEnd(2, "0");
  return `$${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${cents}`;
}
