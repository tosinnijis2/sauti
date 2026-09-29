import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { marketSnapshot, MIN_INSIGHT_LISTINGS } from "@/lib/insights";
import { formatUnitPrice, UNIT_RULES } from "@/lib/units";
import { COMMODITY_LABELS, VARIETY_LABELS, GRADE_LABELS } from "@/lib/commodities";
import { ExactDecimal } from "@/lib/decimal";

export async function MarketSnapshot({ userId }: { userId: string }) {
  const rows = await marketSnapshot(userId);
  return <section aria-label="Market Snapshot" className="mt-10 border-y border-[#eadfdf] py-5">
    <header className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-bold">Market Snapshot</h2><Link href="/market/insights" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[#47715f] hover:underline">Market Insights<ArrowRight size={16} aria-hidden="true" /></Link></header>
    <p className="mt-1 text-xs text-[#6f626b]">Sauti asking prices in USD per unit, not sale prices. Grades and varieties are seller-provided, not verified certification.</p>
    {rows.length ? <div className="mt-4 grid gap-5 sm:grid-cols-3">{rows.map(row => <Link key={`${row.commodity}:${row.variety}:${row.grade}:${row.unit}`} href={"/market/insights?" + new URLSearchParams({ commodity: row.commodity, variety: row.variety ?? "", grade: row.grade ?? "", unit: row.unit })} className="min-w-0 py-2 hover:underline"><h3 className="break-words text-sm font-bold">{COMMODITY_LABELS[row.commodity]}</h3><p className="mt-1 text-xs text-[#6f626b]">{row.variety ? VARIETY_LABELS[row.variety] : "Variety unspecified"} / {row.grade ? GRADE_LABELS[row.grade] : "Grade unspecified"}</p><p className="mt-2 break-words text-lg font-bold text-[#47715f]">{formatUnitPrice(row.median)}/{UNIT_RULES[row.unit].label} <span className="text-xs font-normal">USD median</span></p>{row.trend !== null && <p className="mt-1 text-xs font-semibold text-[#6f626b]">{new ExactDecimal(row.trend).gt(0) ? "+" : ""}{row.trend}% vs previous recorded period</p>}<p className="mt-1 text-xs text-[#6f626b]">{row.count} active comparable listings</p></Link>)}</div> : <p className="mt-4 text-sm text-[#6f626b]">No structured commodity group has enough listings for a price summary yet. At least {MIN_INSIGHT_LISTINGS} are needed.</p>}
  </section>;
}
