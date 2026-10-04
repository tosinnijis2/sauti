import { ExactDecimal } from "@/lib/decimal";
import type { CompletedDealInsights } from "@/lib/completed-deal-insights";
import { MIN_COMPLETED_DEALS, MIN_COMPLETED_DEAL_BUYERS, MIN_COMPLETED_DEAL_SELLERS } from "@/lib/completed-deal-insights";
import { formatPrice } from "@/lib/market";
import { formatUnitPrice, UNIT_RULES, type ComparisonUnit } from "@/lib/units";

export function CompletedDealSignals({ data, unit }: { data: CompletedDealInsights; unit: ComparisonUnit }) {
  const label = UNIT_RULES[unit].label;
  return <section aria-label="Completed deal price signals" className="mt-10 border-y border-[#eadfdf] py-7">
    <p className="text-xs font-bold uppercase text-[#9d334b]">Completed deal signal</p>
    <h2 className="mt-2 text-2xl font-bold">Completed deal price signals</h2>
    <p className="mt-2 max-w-3xl text-sm text-[#6f626b]">Prices participants agreed to in completed Sauti deals. Agreed prices reflect marketplace terms and do not confirm payment occurred.</p>
    {data.summary ? <>
      <dl className="mt-6 grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <div><dt className="text-sm text-[#6f626b]">Median agreed unit price</dt><dd className="mt-2 text-3xl font-bold text-[#9d334b]">{formatUnitPrice(data.summary.medianUnit)}<span className="ml-1 text-xs font-normal text-[#6f626b]">USD/{label}</span></dd></div>
        <div><dt className="text-sm text-[#6f626b]">Median agreed total</dt><dd className="mt-2 text-xl font-bold">{formatPrice({ toString: () => data.summary!.medianTotal })}<span className="ml-1 text-xs font-normal text-[#6f626b]">USD</span></dd></div>
        <div><dt className="text-sm text-[#6f626b]">Lowest normalized signal</dt><dd className="mt-2 text-xl font-bold">{formatUnitPrice(data.summary.low)}<span className="ml-1 text-xs font-normal text-[#6f626b]">USD/{label}</span></dd></div>
        <div><dt className="text-sm text-[#6f626b]">Highest normalized signal</dt><dd className="mt-2 text-xl font-bold">{formatUnitPrice(data.summary.high)}<span className="ml-1 text-xs font-normal text-[#6f626b]">USD/{label}</span></dd></div>
      </dl>
      <p className="mt-4 text-xs text-[#6f626b]">Based on {data.summary.count} qualifying completed deals. This is a Sauti marketplace signal, not a representation of the entire external market.</p>
      {data.history.trend && <p className="mt-4 text-sm font-semibold">Recent qualifying-period trend: {new ExactDecimal(data.history.trend.percentage).gt(0) ? "+" : ""}{data.history.trend.percentage}%</p>}
      {data.history.points.length >= 2 && <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[480px] text-left text-sm"><caption className="sr-only">Privacy-qualified completed deal price periods</caption><thead><tr className="border-b border-[#eadfdf] text-xs text-[#6f626b]"><th className="py-2 pr-3">UTC period</th><th className="py-2 pr-3">Median agreed unit price</th><th className="py-2 text-right">Deals</th></tr></thead><tbody>{data.history.points.map(point => <tr key={point.period} className="border-b border-[#eadfdf]"><td className="py-3 pr-3">{point.period.slice(0, 10)}</td><td className="py-3 pr-3 font-semibold">{formatUnitPrice(point.median)} USD/{label}</td><td className="py-3 text-right">{point.count}</td></tr>)}</tbody></table></div>}
    </> : <div className="mt-6 border-y border-dashed border-[#d9cccc] py-7"><h3 className="text-lg font-bold">Not enough completed Sauti deal data yet.</h3><p className="mt-2 text-sm text-[#6f626b]">Public signals require at least {MIN_COMPLETED_DEALS} completed priced deals from {MIN_COMPLETED_DEAL_SELLERS} distinct sellers and {MIN_COMPLETED_DEAL_BUYERS} distinct buyers in the same comparable cohort.</p></div>}
  </section>;
}
