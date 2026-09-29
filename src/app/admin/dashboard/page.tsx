import Link from "next/link";
import { ArrowUpRight, CheckCircle2, Flag, Users, Store, Package } from "lucide-react";
import { getOverview, parsePeriod, periods } from "@/lib/admin/overview";
import { GrowthChart } from "@/components/admin/growth-chart";

function change(current: number, previous: number) {
  if (!previous) return current ? "No previous-period baseline" : "No change from previous period";
  const percent = (current - previous) / previous * 100;
  return `${percent > 0 ? "+" : ""}${percent.toFixed(1)}% vs previous period`;
}

export default async function AdminDashboard({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const days = parsePeriod((await searchParams).days);
  const data = await getOverview(days);
  const metrics = [
    { label: "Total users", value: data.users, note: `${data.newUsers} new in selected period`, icon: Users, href: "/admin/search?type=users" },
    { label: "Sellers with listings", value: data.sellers, note: "Accounts with at least one current listing", icon: Store, href: "/admin/search?type=users&seller=1" },
    { label: "Current listings", value: data.listings, note: `${data.newListings} created in selected period`, icon: Package, href: "/admin/search?type=listings" },
    { label: "Pending reports", value: data.pendingReports, note: "Unresolved message reports", icon: Flag, href: "/admin/search?type=reports" },
  ];
  return <>
    <div className="flex flex-wrap items-end justify-between gap-5"><div><p className="text-xs font-bold uppercase text-[#996066]">Sauti administration</p><h1 className="mt-2 text-3xl font-bold">Marketplace overview</h1></div><form className="flex items-end gap-2"><label className="grid gap-1 text-xs font-semibold">Growth period<select name="days" defaultValue={days} className="rounded-lg border border-[#d9cccc] bg-white p-2.5 text-sm">{periods.map(period => <option key={period} value={period}>{period === 365 ? "1 year" : `${period} days`}</option>)}</select></label><button className="rounded-lg bg-[#20141d] px-4 py-2.5 text-sm font-semibold text-white">Apply</button></form></div>
    <section id="attention" className="my-7 flex flex-wrap items-center justify-between gap-4 border-y border-[#eadfdf] py-5"><div className="flex items-center gap-3">{data.pendingReports ? <Flag size={21} className="text-[#b5474e]" /> : <CheckCircle2 size={21} className="text-[#16877d]" />}<div><h2 className="font-bold">Attention needed</h2><p className="mt-1 text-sm text-[#6f626b]">{data.pendingReports ? `${data.pendingReports} message reports awaiting review` : "No pending message reports"}</p></div></div><Link href="/admin/search?type=reports" className="flex items-center gap-2 text-sm font-semibold">View report records<ArrowUpRight size={17} /></Link></section>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{metrics.map(({ label, value, note, icon: Icon, href }) => <Link key={label} href={href} className="rounded-lg border border-[#eadfdf] bg-white p-5 hover:border-[#dc666c]"><div className="flex items-center justify-between gap-2 text-sm text-[#6f626b]">{label}<Icon size={18} /></div><p className="mt-4 text-3xl font-bold tabular-nums">{value.toLocaleString("en")}</p><p className="mt-2 text-xs text-[#6f626b]">{note}</p></Link>)}</div>
    <section className="my-7 border-y border-[#eadfdf] py-5"><h2 className="text-lg font-bold">Commerce</h2><dl className="mt-4 grid grid-cols-2 gap-5 md:grid-cols-4">{["Gross merchandise value", "Platform revenue", "Completed orders", "Open disputes"].map(label => <div key={label}><dt className="text-sm text-[#6f626b]">{label}</dt><dd className="mt-2 font-semibold">Not available</dd></div>)}</dl><p className="mt-4 text-xs text-[#6f626b]">Order, payment and dispute tracking are not connected. Listing prices are not sales.</p></section>
    <div className="grid min-w-0 gap-7 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]"><div className="min-w-0"><GrowthChart buckets={data.buckets} /><div className="mt-4 flex flex-wrap gap-5 text-xs text-[#6f626b]"><p>New users: {change(data.newUsers, data.priorUsers)}</p><p>New listings: {change(data.newListings, data.priorListings)}</p></div></div><section className="min-w-0 border-y border-[#eadfdf] py-6"><h2 className="text-lg font-bold">Listings by category</h2>{!data.categories.length && <p className="py-8 text-sm text-[#6f626b]">No listings yet.</p>}<ul className="mt-4 space-y-4">{data.categories.map(category => <li key={category.category}><div className="flex justify-between gap-3 text-sm"><span>{category.category}</span><strong>{category._count.id}</strong></div><div className="mt-2 h-1.5 bg-[#eee9eb]"><div className="h-full bg-[#16877d]" style={{ width: `${category._count.id / Math.max(1, data.listings) * 100}%` }} /></div></li>)}</ul></section></div>
    <section className="mt-8"><h2 className="text-lg font-bold">Recent marketplace activity</h2><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[540px] text-left text-sm"><thead className="border-y border-[#eadfdf] bg-white text-xs text-[#6f626b]"><tr><th className="p-3">Event</th><th className="p-3">Account / listing</th><th className="p-3">Time (UTC)</th></tr></thead><tbody>{data.activity.map(event => <tr key={event.id} className="border-b border-[#eadfdf]"><td className="p-3 font-medium">{event.event}</td><td className="max-w-xs break-words p-3">{event.subject}</td><td className="whitespace-nowrap p-3 text-[#6f626b]"><time dateTime={event.createdAt.toISOString()}>{event.createdAt.toISOString().slice(0, 16).replace("T", " ")}</time></td></tr>)}</tbody></table>{!data.activity.length && <p className="py-8 text-sm text-[#6f626b]">No marketplace activity yet.</p>}</div></section>
  </>;
}
