import Link from "next/link";
import { Search, Plus, ChartNoAxesCombined } from "lucide-react";
import { MarketShell } from "@/components/market-shell";
import { ProductCard } from "@/components/product-card";
import { CountrySelect } from "@/components/country-select";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { productCardSelect } from "@/lib/market";
import { savedProductIds } from "@/lib/favorites";
import { marketFiltersSchema, marketWhere } from "@/lib/market-filters";

const pageSize = 12;

export default async function MarketPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const filters = marketFiltersSchema.parse(await searchParams);
  const { q, category, location, country, page } = filters;
  const where = marketWhere(filters);
  const [products, total, categories, user] = await Promise.all([
    prisma.product.findMany({ where, select: productCardSelect, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (page - 1) * pageSize, take: pageSize }),
    prisma.product.count({ where }),
    prisma.product.groupBy({ by: ["category"], where: { status: "ACTIVE" }, orderBy: { category: "asc" } }),
    getCurrentUser(),
  ]);
  const hasFilters = Boolean(q || category || location || country);
  const saved = await savedProductIds(user?.id, products.map(product => product.id));
  const pageUrl = (number: number) => "/market?" + new URLSearchParams({ q, category, location, country, page: String(number) });
  const fieldClass = "min-w-0 rounded-lg border border-[#d9cccc] bg-white px-3 py-3 text-sm font-normal";
  return <MarketShell>
    <Link href={"/market/insights?" + new URLSearchParams({ q, category, location, country })} className="mb-5 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[#47715f] hover:underline"><ChartNoAxesCombined size={18} aria-hidden="true" />Market Insights</Link>
    <div className="flex flex-wrap items-end justify-between gap-5"><div><p className="text-xs font-bold uppercase text-[#47715f]">Sauti marketplace</p><h1 className="mt-2 text-3xl font-bold md:text-4xl">Find your next good deal.</h1><p className="mt-3 text-sm text-[#6f626b]">Fresh listings. Local sellers. A direct conversation.</p></div><Link href="/listings/new" className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#20141d] px-4 text-sm font-semibold text-white"><Plus size={18} />Sell something</Link></div>
    <form method="get" className="mt-8 grid min-w-0 gap-3 border-y border-[#eadfdf] py-5 sm:grid-cols-2 xl:grid-cols-[1.3fr_1fr_1fr_1fr_auto]">
      <label className="grid min-w-0 gap-2 text-sm font-bold">Search<input name="q" defaultValue={q} maxLength={120} placeholder="Product or description" className={fieldClass} /></label>
      <label className="grid min-w-0 gap-2 text-sm font-bold">Category<select name="category" defaultValue={category} className={fieldClass}><option value="">All categories</option>{categories.map(row => <option key={row.category} value={row.category}>{row.category}</option>)}</select></label>
      <label className="grid min-w-0 gap-2 text-sm font-bold">Location<input name="location" defaultValue={location} maxLength={120} placeholder="City or region" className={fieldClass} /></label>
      <CountrySelect optional defaultValue={country} />
      <button type="submit" title="Search listings" className="mt-auto inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[#fe7a7c] px-4 font-semibold text-[#20141d]"><Search size={18} />Search</button>
    </form>
    <div className="my-6 flex flex-wrap items-center justify-between gap-3"><p className="text-sm font-semibold text-[#6f626b]">{total} {total === 1 ? "listing" : "listings"} found</p>{hasFilters && <Link href="/market" className="text-sm underline">Clear filters</Link>}<span className="text-xs text-[#6f626b]">Newest first</span></div>
    {products.length ? <div className="grid min-w-0 gap-5 sm:grid-cols-2 xl:grid-cols-3">{products.map(product => <ProductCard key={product.id} product={product} viewerId={user?.id} saved={saved.has(product.id)} />)}</div> : <section className="border-y border-dashed border-[#d9cccc] py-16 text-center"><h2 className="text-xl font-bold">{hasFilters ? "No listings match your search" : "The market is ready for your first listing"}</h2><p className="mt-3 text-sm text-[#6f626b]">{hasFilters ? "Try another location or category." : "Bring something useful to your local market."}</p><Link href={hasFilters || page > 1 ? "/market" : "/listings/new"} className="mt-5 inline-flex rounded-lg bg-[#20141d] px-5 py-3 text-sm font-bold text-white">{hasFilters || page > 1 ? "View all listings" : "Sell your first item"}</Link></section>}
    <nav aria-label="Marketplace pagination" className="mt-8 flex items-center justify-between gap-4 text-sm"><span className="text-[#6f626b]">Page {page} of {Math.max(1, Math.ceil(total / pageSize))}</span><div className="flex gap-5">{page > 1 && <Link href={pageUrl(page - 1)} className="underline">Previous</Link>}{page * pageSize < total && <Link href={pageUrl(page + 1)} className="underline">Next</Link>}</div></nav>
  </MarketShell>;
}
