import { ExactDecimal } from "@/lib/decimal";
import { formatUnitPrice, UNIT_RULES, type ComparisonUnit } from "@/lib/units";
import type { PriceHistory } from "@/lib/price-history";

function dateLabel(value: string, granularity: PriceHistory["granularity"]) {
  const date = new Date(value);
  return granularity === "week" ? `Week of ${date.toISOString().slice(0, 10)}` : date.toISOString().slice(0, 10);
}

export function PriceHistoryChart({ history, unit, cohort }: { history: PriceHistory; unit: ComparisonUnit; cohort: string }) {
  const label = UNIT_RULES[unit].label;
  if (history.unavailableReason === "select-commodity") return null;
  if (history.unavailableReason === "search-filter") return <section aria-label="Price History" className="mt-10 border-y border-[#eadfdf] py-6"><h2 className="text-xl font-bold">Price History</h2><p className="mt-2 text-sm text-[#6f626b]">Clear the free-text search to view cohort history. Historical snapshots do not retain mutable listing titles or descriptions.</p></section>;
  if (!history.points.length) return <section aria-label="Price History" className="mt-10 border-y border-[#eadfdf] py-6"><h2 className="text-xl font-bold">Price History</h2><p className="mt-2 text-sm text-[#6f626b]">{history.range === "all" ? "Not enough history yet. A period needs at least five recorded Sauti observations." : "Not enough recorded Sauti history for this period."}</p></section>;

  const values = history.points.map(point => new ExactDecimal(point.median));
  const min = ExactDecimal.min(...values);
  const max = ExactDecimal.max(...values);
  const range = max.minus(min);
  const x = (index: number) => history.points.length === 1 ? 360 : 40 + index * 640 / (history.points.length - 1);
  const y = (value: InstanceType<typeof ExactDecimal>) => range.eq(0) ? 105 : new ExactDecimal(190).minus(value.minus(min).div(range).mul(150)).toNumber();
  const points = values.map((value, index) => `${x(index)},${y(value)}`).join(" ");
  const trend = history.trend;
  const trendValue = trend ? new ExactDecimal(trend.percentage) : null;
  return <section aria-label="Price History" className="mt-10 border-y border-[#eadfdf] py-6">
    <header><p className="text-xs font-bold uppercase text-[#47715f]">Based on Sauti asking prices</p><h2 className="mt-2 text-xl font-bold">Price History</h2><p className="mt-2 text-sm text-[#6f626b]">{cohort} · median USD/{label} by {history.granularity}. Missing periods are not interpolated.</p></header>
    <dl className="mt-5 grid gap-5 sm:grid-cols-3">
      <div><dt className="text-xs text-[#6f626b]">Latest recorded median</dt><dd className="mt-1 text-xl font-bold text-[#47715f]">{formatUnitPrice(history.points.at(-1)!.median)}/{label}</dd></div>
      <div><dt className="text-xs text-[#6f626b]">Previous recorded median</dt><dd className="mt-1 text-xl font-bold">{trend ? `${formatUnitPrice(trend.previous)}/${label}` : "Not enough history"}</dd></div>
      <div><dt className="text-xs text-[#6f626b]">Recorded observations</dt><dd className="mt-1 text-xl font-bold tabular-nums">{history.observationCount}</dd></div>
    </dl>
    {trend && <p className={`mt-4 text-sm font-bold ${trendValue!.gt(0) ? "text-[#872d48]" : trendValue!.lt(0) ? "text-[#47715f]" : "text-[#6f626b]"}`}>{trendValue!.gt(0) ? "+" : ""}{trend.percentage}% vs previous recorded {history.granularity}</p>}
    <div className="mt-5 overflow-hidden" role="img" aria-label={`${cohort} price history in USD per ${label}`}>
      <svg viewBox="0 0 720 230" className="h-auto w-full" aria-hidden="true">
        <line x1="40" y1="190" x2="680" y2="190" stroke="#d9cccc" />
        <line x1="40" y1="40" x2="40" y2="190" stroke="#d9cccc" />
        {history.points.length > 1 && <polyline points={points} fill="none" stroke="#47715f" strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" />}
        {history.points.map((point, index) => <circle key={point.period} cx={x(index)} cy={y(values[index])} r="6" fill="#fe7a7c"><title>{dateLabel(point.period, history.granularity)}: {formatUnitPrice(point.median)}/{label}, {point.observations} observations</title></circle>)}
        <text x="40" y="218" fontSize="12" fill="#6f626b">{dateLabel(history.points[0].period, history.granularity)}</text>
        {history.points.length > 1 && <text x="680" y="218" fontSize="12" textAnchor="end" fill="#6f626b">{dateLabel(history.points.at(-1)!.period, history.granularity)}</text>}
        <text x="48" y="34" fontSize="12" fill="#6f626b">USD/{label}</text>
      </svg>
    </div>
    <ul className="sr-only">{history.points.map(point => <li key={point.period}>{dateLabel(point.period, history.granularity)}: {formatUnitPrice(point.median)} USD per {label}, based on {point.observations} observations</li>)}</ul>
  </section>;
}
