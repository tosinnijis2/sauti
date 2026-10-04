import Link from "next/link";
import { ChartNoAxesCombined, Plus, Search, SlidersHorizontal, X } from "lucide-react";
import { MarketShell } from "@/components/market-shell";
import { ProductCard } from "@/components/product-card";
import { CountrySelect } from "@/components/country-select";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { savedProductIds } from "@/lib/favorites";
import { marketFiltersSchema, type MarketFilters } from "@/lib/market-filters";
import { MARKET_PAGE_SIZE, searchMarket } from "@/lib/market-search";
import { COMMODITIES, COMMODITY_LABELS, GRADES, GRADE_LABELS, VARIETIES, VARIETY_LABELS } from "@/lib/commodities";
import { UNIT_RULES, UNIT_VALUES, PACKAGE_UNITS } from "@/lib/units";
import { countryName } from "@/lib/countries";
import { createSavedSearchAction, setSavedSearchEnabledAction } from "@/app/actions/saved-searches";
import { hasMeaningfulSavedSearch, savedSearchCanonicalKey } from "@/lib/saved-searches";

const labels: Partial<Record<keyof MarketFilters, (value: string) => string>> = {
  q: value => `Search: ${value}`, category: value => `Category: ${value}`,
  commodity: value => `Commodity: ${COMMODITY_LABELS[value as keyof typeof COMMODITY_LABELS]}`,
  variety: value => `Variety: ${VARIETY_LABELS[value as keyof typeof VARIETY_LABELS]}`,
  grade: value => `Grade: ${GRADE_LABELS[value as keyof typeof GRADE_LABELS]}`,
  country: value => `Country: ${countryName(value)}`, location: value => `Location: ${value}`,
  unit: value => `Unit: ${UNIT_RULES[value as keyof typeof UNIT_RULES].label}`,
  minPrice: value => `Min: $${value}`, maxPrice: value => `Max: $${value}`,
};

function paramsFor(filters: MarketFilters, changes: Partial<Record<keyof MarketFilters, string | number | null>> = {}) {
  const values = { ...filters, ...changes, page: changes.page ?? 1 };
  const params = new URLSearchParams();
  for (const [key, raw] of Object.entries(values)) {
    if (raw === "" || raw == null || (key === "page" && raw === 1) || (key === "sort" && raw === "relevance")) continue;
    params.set(key, String(raw));
  }
  return params;
}

export default async function MarketPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const rawSearchParams = await searchParams;
  const filters = marketFiltersSchema.parse(rawSearchParams);
  const { q, category, commodity, variety, grade, location, country, unit, minPrice, maxPrice, page } = filters;
  const [{ products, total, sort }, categories, popularCommodities, popularLocations, activeTotal, user] = await Promise.all([
    searchMarket(filters),
    prisma.product.groupBy({ by: ["category"], where: { status: "ACTIVE" }, _count: { id: true }, orderBy: { _count: { id: "desc" } }, take: 8 }),
    prisma.product.groupBy({ by: ["commodity"], where: { status: "ACTIVE", commodity: { not: null } }, _count: { id: true }, orderBy: { _count: { id: "desc" } }, take: 6 }),
    prisma.product.groupBy({ by: ["location", "country"], where: { status: "ACTIVE", location: { not: "" } }, _count: { id: true }, orderBy: { _count: { id: "desc" } }, take: 6 }),
    prisma.product.count({ where: { status: "ACTIVE" } }),
    getCurrentUser(),
  ]);
  const filterKeys = Object.keys(labels) as (keyof MarketFilters)[];
  const activeFilters = filterKeys.filter(key => Boolean(filters[key]));
  const hasFilters = activeFilters.length > 0;
  const meaningfulSearch = hasMeaningfulSavedSearch(filters);
  const advanced = Boolean(category || commodity || variety || grade || location || country || unit || minPrice || maxPrice);
  const saved = await savedProductIds(user?.id, products.map(product => product.id));
  const savedSearch = user && meaningfulSearch ? await prisma.savedSearch.findUnique({ where: { userId_canonicalKey: { userId: user.id, canonicalKey: savedSearchCanonicalKey(filters) } }, select: { id: true, name: true, enabled: true } }) : null;
  const currentPath = "/market" + (paramsFor(filters, { page }).size ? `?${paramsFor(filters, { page })}` : "");
  const pageUrl = (number: number) => "/market?" + paramsFor(filters, { page: number });
  const fieldClass = "min-w-0 rounded-lg border border-[#d9cccc] bg-white px-3 py-3 text-sm font-normal";
  const unitSortAvailable = Boolean(unit && !PACKAGE_UNITS.includes(unit));
  return <MarketShell>
    <div className="flex flex-wrap items-end justify-between gap-5"><div><p className="text-xs font-bold uppercase text-[#47715f]">Sauti marketplace</p><h1 className="mt-2 text-3xl font-bold md:text-4xl">Find what the market has.</h1><p className="mt-3 text-sm text-[#6f626b]">Search active inventory by product, place, commodity, and asking price.</p></div><div className="flex flex-wrap gap-3"><Link href={"/market/insights?" + new URLSearchParams({ q, category, location, country, commodity, variety, grade, unit: unit || "KG" })} className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[#47715f] hover:underline"><ChartNoAxesCombined size={18} />Market Insights</Link><Link href="/listings/new" className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#20141d] px-4 text-sm font-semibold text-white"><Plus size={18} />Sell something</Link></div></div>

    <form method="get" className="mt-8 border-y border-[#eadfdf] py-5">
      <div className="flex flex-col gap-3 sm:flex-row"><label className="min-w-0 flex-1"><span className="sr-only">Search marketplace</span><input name="q" defaultValue={q} maxLength={120} placeholder="Search products, commodities, locations..." className="min-h-12 w-full rounded-lg border border-[#d9cccc] bg-white px-4 text-base" /></label><button type="submit" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[#fe7a7c] px-5 font-bold text-[#20141d]"><Search size={19} />Search</button></div>
      <details className="mt-4" open={advanced}><summary className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm font-bold"><SlidersHorizontal size={18} />Filters and sorting</summary><div className="mt-3 grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <label className="grid gap-2 text-sm font-bold">Category<select name="category" defaultValue={category} className={fieldClass}><option value="">All categories</option>{categories.map(row => <option key={row.category} value={row.category}>{row.category}</option>)}</select></label>
        <label className="grid gap-2 text-sm font-bold">Commodity<select name="commodity" defaultValue={commodity} className={fieldClass}><option value="">All commodities</option>{COMMODITIES.map(value => <option key={value} value={value}>{COMMODITY_LABELS[value]}</option>)}</select></label>
        <label className="grid gap-2 text-sm font-bold">Variety<select name="variety" defaultValue={variety} className={fieldClass}><option value="">All varieties</option>{VARIETIES.map(value => <option key={value} value={value}>{VARIETY_LABELS[value]}</option>)}</select></label>
        <label className="grid gap-2 text-sm font-bold">Grade<select name="grade" defaultValue={grade} className={fieldClass}><option value="">All grades</option>{GRADES.map(value => <option key={value} value={value}>{GRADE_LABELS[value]}</option>)}</select></label>
        <CountrySelect optional defaultValue={country} />
        <label className="grid gap-2 text-sm font-bold">Location<input name="location" defaultValue={location} maxLength={120} placeholder="City or region" className={fieldClass} /></label>
        <label className="grid gap-2 text-sm font-bold">Listing unit<select name="unit" defaultValue={unit} className={fieldClass}><option value="">All units</option>{UNIT_VALUES.map(value => <option key={value} value={value}>{UNIT_RULES[value].label}</option>)}</select></label>
        <div className="grid grid-cols-2 gap-3"><label className="grid gap-2 text-sm font-bold">Minimum price<input name="minPrice" defaultValue={minPrice} inputMode="decimal" placeholder="0.00" className={fieldClass} /></label><label className="grid gap-2 text-sm font-bold">Maximum price<input name="maxPrice" defaultValue={maxPrice} inputMode="decimal" placeholder="Any" className={fieldClass} /></label></div>
        <label className="grid gap-2 text-sm font-bold">Sort<select name="sort" defaultValue={sort} className={fieldClass}><option value="relevance">{q ? "Relevance" : "Newest"}</option><option value="newest">Newest</option><option value="price_asc">Asking price: low to high</option><option value="price_desc">Asking price: high to low</option>{unitSortAvailable && <><option value="unit_asc">Unit price: low to high</option><option value="unit_desc">Unit price: high to low</option></>}</select></label>
        <button type="submit" className="mt-auto min-h-12 rounded-lg bg-[#20141d] px-5 text-sm font-bold text-white">Apply filters</button>
      </div></details>
    </form>

    {activeFilters.length > 0 && <div aria-label="Active filters" className="mt-5 flex flex-wrap gap-2">{activeFilters.map(key => <Link key={key} href={"/market?" + paramsFor(filters, { [key]: null })} className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-[#d9cccc] bg-white px-3 text-xs font-semibold">{labels[key]!(String(filters[key]))}<X size={14} aria-hidden="true" /></Link>)}<Link href="/market" className="inline-flex min-h-9 items-center px-2 text-xs font-bold underline">Clear all</Link></div>}

    {meaningfulSearch && <section aria-label="Saved search controls" className="mt-5 border-y border-[#eadfdf] py-4">{savedSearch ? <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-bold">This search is saved as “{savedSearch.name}”.</p><p className="mt-1 text-xs text-[#6f626b]">New matching active listings {savedSearch.enabled ? "will create notifications" : "are currently muted"}.</p></div><div className="flex flex-wrap gap-4"><form action={setSavedSearchEnabledAction}><input type="hidden" name="id" value={savedSearch.id} /><input type="hidden" name="enabled" value={String(!savedSearch.enabled)} /><button className="min-h-11 text-sm font-bold underline">{savedSearch.enabled ? "Disable notifications" : "Enable notifications"}</button></form><Link href="/saved-searches" className="inline-flex min-h-11 items-center text-sm font-bold text-[#47715f] underline">Manage saved searches</Link></div></div> : user ? <form action={createSavedSearchAction} className="flex flex-wrap items-end gap-3">{(["q", "category", "commodity", "variety", "grade", "country", "location", "unit", "minPrice", "maxPrice", "sort"] as const).map(key => <input key={key} type="hidden" name={key} value={filters[key]} />)}<label className="min-w-[220px] flex-1 text-sm font-bold">Search name <span className="font-normal text-[#6f626b]">(optional)</span><input name="name" maxLength={80} placeholder="e.g. Maize in Kenya" className="mt-2 min-h-11 w-full rounded-lg border border-[#d9cccc] bg-white px-3 font-normal" /></label><button className="min-h-11 rounded-lg bg-[#20141d] px-5 text-sm font-bold text-white">Save this search</button>{rawSearchParams.saved === "1" && <span className="text-sm font-semibold text-[#47715f]">Search saved.</span>}{typeof rawSearchParams.saveError === "string" && <span className="text-sm font-semibold text-[#9d334b]">{rawSearchParams.saveError}</span>}</form> : <p className="text-sm"><Link href={`/login?next=${encodeURIComponent(currentPath)}`} className="font-bold text-[#47715f] underline">Sign in</Link> to save this search and receive new-listing notifications.</p>}</section>}

    {!hasFilters && page === 1 && activeTotal > 0 && <section aria-label="Browse marketplace" className="mt-7 grid gap-6 border-y border-[#eadfdf] py-6 lg:grid-cols-3"><div><h2 className="text-sm font-bold">Popular commodities</h2><div className="mt-3 flex flex-wrap gap-2">{popularCommodities.map(row => row.commodity && <Link key={row.commodity} href={`/market?commodity=${row.commodity}`} className="text-sm text-[#47715f] underline">{COMMODITY_LABELS[row.commodity]} ({row._count.id})</Link>)}</div></div><div><h2 className="text-sm font-bold">Browse by category</h2><div className="mt-3 flex flex-wrap gap-2">{categories.slice(0, 6).map(row => <Link key={row.category} href={"/market?category=" + encodeURIComponent(row.category)} className="text-sm text-[#47715f] underline">{row.category} ({row._count.id})</Link>)}</div></div><div><h2 className="text-sm font-bold">Browse by location</h2><div className="mt-3 flex flex-wrap gap-2">{popularLocations.map(row => <Link key={`${row.country}:${row.location}`} href={"/market?" + new URLSearchParams({ location: row.location, ...(row.country ? { country: row.country } : {}) })} className="text-sm text-[#47715f] underline">{row.location}{row.country ? `, ${countryName(row.country)}` : ""} ({row._count.id})</Link>)}</div></div></section>}

    <div className="my-6 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-bold">{!hasFilters && page === 1 ? "Recently listed" : "Marketplace results"}</h2><p className="mt-1 text-sm text-[#6f626b]">{total} active {total === 1 ? "listing" : "listings"}</p></div><p className="text-xs text-[#6f626b]">{sort === "relevance" && q ? "Ranked by explainable keyword relevance" : sort === "price_asc" ? "Lowest asking price first" : sort === "price_desc" ? "Highest asking price first" : sort === "unit_asc" ? "Lowest comparable unit price first" : sort === "unit_desc" ? "Highest comparable unit price first" : "Newest first"}</p></div>
    {products.length ? <div className="grid min-w-0 gap-5 sm:grid-cols-2 xl:grid-cols-3">{products.map(product => <ProductCard key={product.id} product={product} viewerId={user?.id} saved={saved.has(product.id)} returnTo={currentPath} />)}</div> : <section className="border-y border-dashed border-[#d9cccc] py-16 text-center"><h2 className="text-xl font-bold">{activeTotal === 0 ? "No active listings available" : "No listings match these filters"}</h2><p className="mt-3 text-sm text-[#6f626b]">{activeTotal === 0 ? "The marketplace is waiting for its next active listing." : "Clear a filter, broaden the location, or browse the newest listings."}</p><div className="mt-5 flex flex-wrap justify-center gap-4"><Link href={activeTotal === 0 ? "/listings/new" : "/market"} className="inline-flex min-h-11 items-center rounded-lg bg-[#20141d] px-5 text-sm font-bold text-white">{activeTotal === 0 ? "Create a listing" : "Clear filters"}</Link>{activeTotal > 0 && <Link href="/market?sort=newest" className="inline-flex min-h-11 items-center text-sm font-bold underline">Browse newest listings</Link>}</div></section>}
    {total > 0 && <nav aria-label="Marketplace pagination" className="mt-8 flex items-center justify-between gap-4 text-sm"><span className="text-[#6f626b]">Page {page} of {Math.max(1, Math.ceil(total / MARKET_PAGE_SIZE))}</span><div className="flex gap-5">{page > 1 && <Link href={pageUrl(page - 1)} className="underline">Previous</Link>}{page * MARKET_PAGE_SIZE < total && <Link href={pageUrl(page + 1)} className="underline">Next</Link>}</div></nav>}
  </MarketShell>;
}
