import type { ListingUnit } from "@prisma/client";
import { formatPrice } from "@/lib/market";
import { ExactDecimal } from "@/lib/decimal";
import { normalizedPrice, UNIT_RULES, formatUnitPrice, quantityLabel } from "@/lib/units";

type DecimalValue = { toString(): string };
export function ListingPrice({ product, large = false }: { product: {
  price: DecimalValue; quantity: DecimalValue | null; originalQuantity?: DecimalValue | null;
  remainingQuantity?: DecimalValue | null; unit: ListingUnit | null;
  packageQuantity?: DecimalValue | null; packageUnit?: ListingUnit | null;
}; large?: boolean }) {
  const normalized = normalizedPrice(product.price, product.quantity, product.unit, product.packageQuantity, product.packageUnit);
  const original = product.originalQuantity ?? product.quantity;
  const remaining = product.remainingQuantity ?? product.quantity;
  const sold = original && remaining ? new ExactDecimal(original.toString()).sub(remaining.toString()) : null;
  return <div className="min-w-0">
    <p className="text-xs font-bold uppercase text-[#6f626b]">Asking price</p><p className={`break-words font-bold tabular-nums ${large ? "text-3xl" : "text-2xl"}`}>{formatPrice(product.price)} <span className="text-xs font-medium text-[#6f626b]">USD</span></p>
    {normalized && product.unit ? <><p className="mt-1 text-sm text-[#6f626b]">Applies to {quantityLabel(product.quantity!, product.unit)}</p>{original && remaining && <p className="mt-2 text-xs font-semibold text-[#47715f]">{quantityLabel(original, product.unit)} listed{sold?.gt(0) ? ` · ${quantityLabel(sold, product.unit)} sold` : ""} · {quantityLabel(remaining, product.unit)} available</p>}{product.packageQuantity && product.packageUnit && <p className="mt-1 text-xs text-[#6f626b]">Each {UNIT_RULES[product.unit].label}: {quantityLabel(product.packageQuantity, product.packageUnit)}</p>}<p className="mt-1 break-words text-sm font-semibold text-[#47715f]">Normalized asking price: {formatUnitPrice(normalized.price)}/{UNIT_RULES[normalized.unit].label} <span className="text-xs font-normal">USD</span></p></> : <p className="mt-1 text-xs text-[#6f626b]">Quantity and unit not specified</p>}
  </div>;
}
