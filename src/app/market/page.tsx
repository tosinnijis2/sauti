import { AppShell } from "@/components/app-shell";
const items = [
  { item: "Groundnuts", category: "Seeds & Nuts", location: "Busia, Uganda", price: "$42" },
  { item: "Maize", category: "Cereals", location: "Nairobi, Kenya", price: "$31" },
  { item: "Beans", category: "Beans", location: "Kampala, Uganda", price: "$37" },
];
export default function MarketPage() { return <AppShell><h1 className="text-4xl font-black">Market prices</h1><p className="mt-2 text-[#6f626b]">Placeholder data for the migration baseline. This will come from PostgreSQL.</p><div className="mt-8 overflow-hidden rounded-3xl border border-[#eadfdf] bg-white"><div className="grid grid-cols-4 bg-[#20141d] px-5 py-4 text-sm font-bold text-white"><span>Product</span><span>Category</span><span>Location</span><span className="text-right">Price</span></div>{items.map(x => <div key={x.item} className="grid grid-cols-4 border-t border-[#eadfdf] px-5 py-4 text-sm"><span className="font-bold">{x.item}</span><span>{x.category}</span><span>{x.location}</span><span className="text-right font-bold">{x.price}</span></div>)}</div></AppShell>; }
