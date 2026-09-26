import Link from "next/link";
import { ArrowRight, BarChart3, Globe2, Smartphone, Store } from "lucide-react";
import { SiteHeader } from "@/components/site-header";

const features = [
  { icon: Smartphone, title: "Mobile-first marketplace", text: "List products and manage your trading activity from any device." },
  { icon: BarChart3, title: "Market price intelligence", text: "Compare prices across products and locations before making a trade." },
  { icon: Globe2, title: "Location-aware discovery", text: "Find relevant products and sellers by market, region, and category." },
];

export default function Home() {
  return (
    <main>
      <section className="min-h-[650px] bg-[#20141d] text-white">
        <SiteHeader />
        <div className="mx-auto grid max-w-6xl gap-12 px-6 pb-24 pt-16 lg:grid-cols-[1.1fr_.9fr] lg:items-center lg:pt-24">
          <div>
            <span className="inline-flex rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm text-white/80">Sauti 2.0 · rebuilt for the modern web</span>
            <h1 className="mt-6 max-w-3xl text-5xl font-black leading-tight sm:text-6xl">Trade with better information, not guesswork.</h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-white/70">A modern marketplace where traders can list products, compare market prices, manage listings, and build a trusted profile.</p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link href="/register" className="inline-flex items-center gap-2 rounded-full bg-[#fe7a7c] px-6 py-3 font-bold text-[#20141d]">Create an account <ArrowRight size={18} /></Link>
              <Link href="/market" className="rounded-full border border-white/20 px-6 py-3 font-bold">Browse marketplace</Link>
            </div>
          </div>
          <div className="rounded-[2rem] border border-white/10 bg-white/5 p-5 backdrop-blur">
            <div className="rounded-[1.5rem] bg-[#fffaf8] p-6 text-[#20141d]">
              <div className="flex items-center justify-between"><div><p className="text-sm font-semibold text-[#6f626b]">Market snapshot</p><h2 className="mt-1 text-2xl font-black">Today&apos;s listings</h2></div><Store className="text-[#fe7a7c]" /></div>
              <div className="mt-8 grid gap-3">
                {["Groundnuts · Busia", "Maize · Nairobi", "Beans · Kampala"].map((item, i) => <div key={item} className="flex items-center justify-between rounded-2xl border border-[#eadfdf] bg-white px-4 py-4"><span className="font-semibold">{item}</span><span className="text-sm text-[#6f626b]">{["$42", "$31", "$37"][i]}</span></div>)}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-6xl px-6 py-24">
        <p className="text-sm font-bold uppercase tracking-[.2em] text-[#fe7a7c]">What Sauti does</p>
        <h2 className="mt-3 max-w-2xl text-4xl font-black">The strongest ideas from the original app, rebuilt cleanly.</h2>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {features.map(({ icon: Icon, title, text }) => <article key={title} className="rounded-3xl border border-[#eadfdf] bg-white p-7"><div className="grid size-12 place-items-center rounded-2xl bg-[#ffe0df]"><Icon className="text-[#20141d]" /></div><h3 className="mt-6 text-xl font-bold">{title}</h3><p className="mt-3 leading-7 text-[#6f626b]">{text}</p></article>)}
        </div>
      </section>
    </main>
  );
}
