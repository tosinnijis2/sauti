import Link from "next/link";
import { completedDealMarketSnapshot } from "@/lib/completed-deal-insights";
import { cohortLabel } from "@/lib/commodities";
import { formatUnitPrice, UNIT_RULES } from "@/lib/units";

export async function CompletedDealSnapshot() {
  const row = (await completedDealMarketSnapshot())[0];
  if (!row) return null;
  return <section aria-label="Completed deal market signal" className="mt-6 border-y border-[#eadfdf] py-5"><p className="text-xs font-bold uppercase text-[#9d334b]">Completed deal signal</p><div className="mt-2 flex flex-wrap items-end justify-between gap-4"><div><h2 className="text-xl font-bold">{cohortLabel(row.commodity, row.variety, row.grade)}</h2><p className="mt-2 text-lg font-bold text-[#9d334b]">{formatUnitPrice(row.medianUnit)} USD/{UNIT_RULES[row.unit].label} <span className="text-xs font-normal text-[#6f626b]">median agreed price</span></p><p className="mt-1 text-xs text-[#6f626b]">{row.count} privacy-qualified completed deals. Agreement does not confirm payment.</p></div><Link href={"/market/insights?" + new URLSearchParams({ commodity: row.commodity, variety: row.variety ?? "", grade: row.grade ?? "", unit: row.unit })} className="text-sm font-semibold text-[#47715f] underline">View signal</Link></div></section>;
}
