import Link from "next/link";
import { ArrowRight, BarChart3, Handshake, MapPin, Store } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { prisma } from "@/lib/prisma";
import { quantityLabel } from "@/lib/units";

export const dynamic = "force-dynamic";

const features = [
  { icon: MapPin, title: "Buy & Sell Locally", text: "Discover active listings by country and location, then speak directly with sellers." },
  { icon: BarChart3, title: "Understand Market Prices", text: "Compare Sauti asking-price medians and historical movement across standardized units." },
  { icon: Handshake, title: "Trade With More Confidence", text: "Use verified-email, completed-deal, and moderated-review signals when evaluating a seller." },
];

export default async function Home() {
  const latestListings = await prisma.product.findMany({
    where: { status: "ACTIVE" },
    take: 3,
    orderBy: { createdAt: "desc" },
    select: { id: true, item: true, location: true, price: true, quantity: true, unit: true },
  });

  return (
    <main>
      <section className="min-h-[calc(100svh-120px)] bg-[#20141d] text-white">
        <SiteHeader />
        <div className="mx-auto grid max-w-6xl gap-12 px-6 pb-6 pt-6 sm:pb-16 sm:pt-12 lg:grid-cols-[1.1fr_.9fr] lg:items-center lg:pt-16">
          <div>
            <span className="hidden rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm text-white/80 sm:inline-flex">Sauti 2.0 · rebuilt for the modern web</span>
            <h1 className="max-w-3xl text-[2rem] font-black leading-tight sm:mt-6 sm:text-6xl">Trade with better information, not guesswork.</h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-white/70 sm:mt-6 sm:text-lg sm:leading-8">
              <span className="sm:hidden">List products, compare prices, and trade locally with confidence.</span>
              <span className="hidden sm:inline">A modern marketplace where traders can list products, compare market prices, manage listings, and build a trusted profile.</span>
            </p>
            <div className="mt-5 flex flex-wrap gap-2 sm:mt-8 sm:gap-4">
              <Link href="/register" className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#fe7a7c] px-6 py-3 font-bold text-[#20141d] sm:w-auto">Create an account <ArrowRight size={18} /></Link>
              <Link href="/market" className="w-full rounded-full border border-white/20 px-6 py-3 text-center font-bold sm:w-auto">Browse marketplace</Link>
            </div>
          </div>
          <div className="hidden border-l border-white/15 pl-10 lg:block">
            <div className="bg-[#fffaf8] p-6 text-[#20141d]">
              <div className="flex items-center justify-between"><div><p className="text-sm font-semibold text-[#6f626b]">Market snapshot</p><h2 className="mt-1 text-2xl font-black">Today&apos;s listings</h2></div><Store className="text-[#fe7a7c]" /></div>
              {latestListings.length > 0 ? (
                <div className="mt-8 grid gap-3">
                  {latestListings.map((listing) => (
                    <Link href={`/market/${listing.id}`} key={listing.id} className="flex items-center justify-between gap-4 border-b border-[#eadfdf] bg-white px-4 py-4 last:border-0">
                      <span className="font-semibold">{listing.item} · {listing.location}</span>
                      <span className="text-right text-sm text-[#6f626b]">${Number(listing.price).toFixed(2)} USD{listing.quantity && listing.unit && <span className="block">for {quantityLabel(listing.quantity, listing.unit)}</span>}</span>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="mt-8 border border-dashed border-[#d9cccc] bg-white px-4 py-8 text-center text-sm text-[#6f626b]">
                  New marketplace listings will appear here.
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-6xl px-6 py-8 sm:py-20">
        <p className="text-sm font-bold uppercase tracking-[.2em] text-[#fe7a7c]">What Sauti does</p>
        <h2 className="mt-3 max-w-2xl text-4xl font-black">The tools to find, compare, and discuss a local trade.</h2>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {features.map(({ icon: Icon, title, text }) => <article key={title} className="border-t-4 border-[#fe7a7c] bg-white p-7 shadow-[0_12px_35px_rgba(32,20,29,.06)]"><div className="grid size-12 place-items-center rounded-full bg-[#ffe0df]"><Icon className="text-[#20141d]" /></div><h3 className="mt-6 text-xl font-bold">{title}</h3><p className="mt-3 leading-7 text-[#6f626b]">{text}</p></article>)}
        </div>
      </section>
      <section className="bg-[#e1ece7] px-6 py-14"><div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 sm:flex-row sm:items-center"><div><p className="text-sm font-bold uppercase text-[#47715f]">Market Insights</p><h2 className="mt-2 text-3xl font-black text-[#20141d]">See what sellers are asking across Sauti.</h2></div><Link href="/market/insights" className="inline-flex min-h-12 items-center gap-2 rounded-full bg-[#20141d] px-6 font-bold text-white">Explore insights <ArrowRight size={18} /></Link></div></section>
    </main>
  );
}
