import { COMMODITY_LABELS, VARIETY_LABELS, GRADE_LABELS, type Commodity, type Variety, type Grade } from "@/lib/commodities";

export function CommodityMetadata({ product, full = false }: { product: { commodity: Commodity | null; variety: Variety | null; grade: Grade | null }; full?: boolean }) {
  if (!product.commodity) return null;
  const values = [COMMODITY_LABELS[product.commodity], product.variety ? VARIETY_LABELS[product.variety] : full ? "Variety unspecified" : null, product.grade ? GRADE_LABELS[product.grade] : full ? "Grade unspecified" : null];
  return <div className="mt-2"><p className="break-words text-xs font-medium text-[#47715f]">{values.filter(Boolean).join(" / ")}</p>{full && <p className="mt-2 text-xs text-[#6f626b]">Commodity, variety and grade are seller-provided, not verified certification.</p>}</div>;
}
