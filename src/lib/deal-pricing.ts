import { ExactDecimal, decimalMoney, type DecimalValue } from "./decimal";

export function formatAgreedPrice(price: DecimalValue, currency: string) {
  return currency === "USD" ? `${decimalMoney(price, 2)} agreed` : `${decimalMoney(price, 2)} ${currency} agreed`;
}

export function agreedUnitPrice(price: DecimalValue, quantity: DecimalValue) {
  return new ExactDecimal(price.toString()).div(quantity.toString());
}
