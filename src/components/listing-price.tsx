import type { ListingUnit } from "@prisma/client";
import { formatPrice } from "@/lib/market";
import { normalizedPrice, UNIT_RULES, formatUnitPrice, quantityLabel } from "@/lib/units";

export function ListingPrice({ product, large = false }: { product: { price: { toString(): string }; quantity: { toString(): string } | null; unit: ListingUnit | null; packageQuantity?: { toString(): string } | null; packageUnit?: ListingUnit | null }; large?: boolean }) {
  const normalized = normalizedPrice(product.price, product.quantity, product.unit, product.packageQuantity, product.packageUnit);
  return <div className="min-w-0">
    <p className={`break-words font-bold tabular-nums ${large ? "text-3xl" : "text-2xl"}`}>{formatPrice(product.price)} <span className="text-xs font-medium text-[#6f626b]">USD</span></p>
    {normalized && product.unit ? <><p className="mt-1 text-sm text-[#6f626b]">for {quantityLabel(product.quantity!, product.unit)}</p>{product.packageQuantity && product.packageUnit && <p className="mt-1 text-xs text-[#6f626b]">Each {UNIT_RULES[product.unit].label}: {quantityLabel(product.packageQuantity, product.packageUnit)}</p>}<p className="mt-1 break-words text-sm font-semibold text-[#47715f]">{formatUnitPrice(normalized.price)}/{UNIT_RULES[normalized.unit].label} <span className="text-xs font-normal">USD</span></p></> : <p className="mt-1 text-xs text-[#6f626b]">Quantity and unit not specified</p>}
  </div>;
}
