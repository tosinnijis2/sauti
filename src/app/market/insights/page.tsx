import Link from "next/link";
import { ArrowLeft, BellRing, Search } from "lucide-react";
import { createPriceWatchAction } from "@/app/actions/price-watches";
import { MarketShell } from "@/components/market-shell";
import { CountrySelect } from "@/components/country-select";
import { ProductCard } from "@/components/product-card";
import { getCurrentUser } from "@/lib/auth";
import { countryName } from "@/lib/countries";
import { savedProductIds } from "@/lib/favorites";
import { marketInsights, MIN_INSIGHT_LISTINGS, INSIGHT_PAGE_SIZE } from "@/lib/insights";
import { formatUnitPrice, UNIT_RULES, COMPARISON_UNITS } from "@/lib/units";
import { insightFiltersSchema } from "@/lib/insight-filters";
import { prisma } from "@/lib/prisma";
import { ExactDecimal } from "@/lib/decimal";
import { cohortLabel } from "@/lib/commodities";
import { InsightCommodityFilters } from "@/components/insight-commodity-filters";
import { historicalPriceHistory } from "@/lib/price-history";
import { PriceHistoryChart } from "@/components/price-history-chart";

export default async function InsightsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const rawParams = await searchParams;
  const filters = insightFiltersSchema.parse(rawParams);
  const { q, category, location, country, unit, commodity, variety, grade, range } = filters;
  const unitLabel = UNIT_RULES[unit].label;
  const [data, history, categories, user] = await Promise.all([
    marketInsights(filters),
    historicalPriceHistory(filters),
    prisma.product.groupBy({ by: ["category"], where: { status: "ACTIVE" }, orderBy: { category: "asc" } }),
    getCurrentUser(),
  ]);
  const saved = await savedProductIds(user?.id, data.products.map(product => product.id));
  const pageUrl = (page: number) => "/market/insights?" + new URLSearchParams({ q, category, location, country, unit, commodity, variety, grade, range, page: String(page) });
  const maxMedian = data.locations.reduce((max, row) => new ExactDecimal(row.median).gt(max) ? row.median : max, "0");
  const fieldClass = "min-w-0 rounded-lg border border-[#d9cccc] bg-white px-3 py-3 text-sm font-normal";
  return <MarketShell>
    <Link href="/market" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[#47715f] hover:underline"><ArrowLeft size={16} aria-hidden="true" />Marketplace</Link>
    <header className="mt-4"><p className="text-xs font-bold uppercase text-[#47715f]">Sauti asking prices</p><h1 className="mt-2 text-3xl font-bold">Market Insights</h1><p className="mt-3 max-w-2xl text-sm text-[#6f626b]">Active listing prices in USD per {unitLabel}, not completed-sale prices or official market prices.</p></header>
    <form method="get" className="mt-7 grid min-w-0 gap-3 border-y border-[#eadfdf] py-5 sm:grid-cols-2 xl:grid-cols-3">
      <InsightCommodityFilters key={JSON.stringify(filters)} groups={data.groups} initial={{ commodity, variety, grade }} fieldClass={fieldClass} />
      <label className="grid min-w-0 gap-2 text-sm font-bold">Product or search term<input name="q" defaultValue={q} maxLength={120} placeholder="Product or description" className={fieldClass} /></label>
      <label className="grid min-w-0 gap-2 text-sm font-bold">Category<select name="category" defaultValue={category} className={fieldClass}><option value="">All categories</option>{category && !categories.some(row => row.category === category) && <option value={category}>{category}</option>}{categories.map(row => <option key={row.category} value={row.category}>{row.category}</option>)}</select></label>
      <label className="grid min-w-0 gap-2 text-sm font-bold">Location<input name="location" defaultValue={location} maxLength={120} placeholder="City or region" className={fieldClass} /></label>
      <CountrySelect optional defaultValue={country} />
      <label className="grid min-w-0 gap-2 text-sm font-bold">Compare per unit<select name="unit" defaultValue={unit} className={fieldClass}>{COMPARISON_UNITS.map(value => <option key={value} value={value}>{UNIT_RULES[value].label}{value === "KG" ? " (g, kg, tonne)" : value === "LITRE" ? " (ml, litre)" : ""}</option>)}</select></label>
      <label className="grid min-w-0 gap-2 text-sm font-bold">History range<select name="range" defaultValue={range} className={fieldClass}><option value="30">30 days</option><option value="90">90 days</option><option value="180">6 months</option><option value="365">1 year</option><option value="all">All recorded history</option></select></label>
      <button type="submit" title="Filter insights" className="mt-auto inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[#fe7a7c] px-4 font-semibold text-[#20141d]"><Search size={18} aria-hidden="true" />Apply</button>
    </form>
    <div className="my-5 flex flex-wrap items-center justify-between gap-3 text-sm"><p className="font-semibold text-[#6f626b]">{commodity ? `${cohortLabel(commodity, variety || null, grade || null)}: ${data.count} active comparable listings` : "Select a commodity group for price statistics"} · USD/{unitLabel}</p><Link href="/market/insights" className="underline">Clear filters</Link></div>
    {data.groups.length > 0 && <details className="my-5 border-y border-[#eadfdf] py-4" open={!commodity}><summary className="cursor-pointer text-sm font-semibold">Available comparison groups ({data.groups.length})</summary><ul className="mt-3 grid gap-3 sm:grid-cols-2">{data.groups.map(group => <li key={`${group.commodity}:${group.variety}:${group.grade}`}><Link className="inline-block min-h-11 text-sm text-[#47715f] hover:underline" href={"/market/insights?" + new URLSearchParams({ q, category, country, location, unit, range, commodity: group.commodity, variety: group.variety ?? "", grade: group.grade ?? "" })}>{cohortLabel(group.commodity, group.variety, group.grade)}<span className="block text-xs text-[#6f626b]">{group.count} active listings · USD/{unitLabel}</span></Link></li>)}</ul></details>}
    {data.summary ? <section aria-label="Sauti asking prices" className="border-y border-[#eadfdf] py-6">
      <dl className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        {[{ label: "Median asking price", value: data.summary.median }, { label: "Average asking price", value: data.summary.average }, { label: "Lowest asking price", value: data.summary.low }, { label: "Highest asking price", value: data.summary.high }].map((stat, index) => <div key={stat.label} className="min-w-0"><dt className="text-sm text-[#6f626b]">{stat.label}</dt><dd className={`mt-2 break-words font-bold tabular-nums ${index === 0 ? "text-3xl text-[#47715f]" : "text-xl"}`}>{formatUnitPrice(stat.value)}<span className="ml-1 text-xs font-normal text-[#6f626b]">USD/{unitLabel}</span></dd></div>)}
      </dl>
    </section> : <section className="border-y border-dashed border-[#d9cccc] py-8"><h2 className="text-xl font-bold">{!commodity ? "Choose a commodity comparison group." : data.count ? "Not enough listings yet to summarize asking prices." : "No active comparable listings match these filters."}</h2><p className="mt-2 text-sm text-[#6f626b]">Price summaries require at least {MIN_INSIGHT_LISTINGS} active listings with the same commodity, variety, grade and compatible unit. Unspecified attributes form separate groups.</p></section>}
    <p className="mt-4 max-w-3xl text-sm text-[#6f626b]">Grades and varieties are seller-provided, not verified certification. Packages convert to kg, litre or item only when their contents are explicit. Unspecified package contents stay in separate package-unit groups. Legacy listings without commodity, quantity or unit are excluded. These are asking prices, not guarantees of quality or market coverage.</p>

    {commodity && <section className="mt-8 border-y border-[#eadfdf] py-6"><div className="flex items-center gap-2"><BellRing size={20} className="text-[#9d334b]" /><h2 className="text-xl font-bold">Watch this price</h2></div><p className="mt-2 text-sm text-[#6f626b]">{cohortLabel(commodity, variety || null, grade || null)} · USD/{unitLabel}{country ? ` · ${countryName(country)}` : ""}{location ? ` · ${location}` : ""}</p>{typeof rawParams.error === "string" && <p className="mt-3 text-sm font-semibold text-[#9d334b]">{rawParams.error}</p>}{user ? <form action={createPriceWatchAction} className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"><input type="hidden" name="commodity" value={commodity} /><input type="hidden" name="variety" value={variety} /><input type="hidden" name="grade" value={grade} /><input type="hidden" name="normalizedUnit" value={unit} /><input type="hidden" name="country" value={country} /><input type="hidden" name="location" value={location} /><label className="grid gap-2 text-sm font-bold">Notify me when<select name="condition" className={fieldClass}><option value="BELOW">Median falls below</option><option value="ABOVE">Median rises above</option><option value="PERCENT_DROP">Median drops by</option><option value="PERCENT_RISE">Median rises by</option></select></label><label className="grid gap-2 text-sm font-bold">Threshold<input name="threshold" required inputMode="decimal" placeholder="1.20 or 10" className={fieldClass} /></label><button className="mt-auto inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[#20141d] px-5 text-sm font-bold text-white"><BellRing size={18} />Create watch</button></form> : <Link href={`/login?next=${encodeURIComponent("/market/insights?" + new URLSearchParams({ commodity, variety, grade, unit, country, location, range }))}`} className="mt-4 inline-flex min-h-11 items-center rounded-lg bg-[#20141d] px-4 text-sm font-bold text-white">Sign in to create a watch</Link>}</section>}

    {commodity && <PriceHistoryChart history={history} unit={unit} cohort={cohortLabel(commodity, variety || null, grade || null)} />}

    <section aria-label="Median asking price by location" className="mt-10">
      <h2 className="text-xl font-bold">Median asking price by location</h2>
      <p className="mt-2 text-sm text-[#6f626b]">Sauti asking prices in USD/{unitLabel}. Up to eight locations with at least {MIN_INSIGHT_LISTINGS} comparable listings, ordered by sample size.</p>
      {data.locations.length ? <table className="mt-5 w-full table-fixed border-collapse text-left text-sm"><caption className="sr-only">Location, median USD per {unitLabel} and comparable listing count</caption><thead><tr className="border-b border-[#eadfdf] text-xs text-[#6f626b]"><th className="w-[40%] py-3 pr-3 font-medium" scope="col">Location</th><th className="py-3 pr-3 font-medium" scope="col">Median (USD/{unitLabel})</th><th className="w-16 py-3 text-right font-medium" scope="col">Listings</th></tr></thead><tbody>{data.locations.map(row => <tr key={`${row.country}:${row.location}`} className="border-b border-[#eadfdf]"><th scope="row" className="break-words py-4 pr-3 font-semibold">{row.location}<span className="mt-1 block text-xs font-normal text-[#6f626b]">{row.country ? countryName(row.country) : "Country unspecified"}</span></th><td className="py-4 pr-3"><span className="break-words font-semibold tabular-nums">{formatUnitPrice(row.median)}</span><div aria-hidden="true" className="mt-2 h-2 w-full bg-[#eadfdf]"><div className="h-2 bg-[#47715f]" style={{ width: `${new ExactDecimal(row.median).div(maxMedian).mul(100).toFixed(3)}%` }} /></div></td><td className="py-4 text-right tabular-nums">{row.count}</td></tr>)}</tbody></table> : <p className="mt-5 border-y border-dashed border-[#d9cccc] py-6 text-sm text-[#6f626b]">Not enough matching listings in any one location for a location comparison.</p>}
    </section>

    <section aria-label="Contributing listings" className="mt-10"><header className="mb-5"><h2 className="text-xl font-bold">Contributing listings</h2><p className="mt-2 text-sm text-[#6f626b]">The matching listings behind this sample, newest first.</p></header>
      {data.products.length > 0 && <div className="grid min-w-0 gap-5 sm:grid-cols-2 xl:grid-cols-3">{data.products.map(product => <ProductCard key={product.id} product={product} viewerId={user?.id} saved={saved.has(product.id)} />)}</div>}
      {data.count > 0 && <nav aria-label="Insights listing pagination" className="mt-6 flex items-center justify-between gap-4 text-sm"><span>Page {data.page} of {Math.ceil(data.count / INSIGHT_PAGE_SIZE)}</span><div className="flex gap-5">{data.page > 1 && <Link className="underline" href={pageUrl(data.page - 1)}>Previous</Link>}{data.page * INSIGHT_PAGE_SIZE < data.count && <Link className="underline" href={pageUrl(data.page + 1)}>Next</Link>}</div></nav>}
    </section>
  </MarketShell>;
}
