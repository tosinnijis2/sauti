import Link from "next/link";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/auth";
import { prisma } from "@/lib/prisma";

const querySchema = z.object({ q: z.string().trim().max(100).catch(""), type: z.enum(["users", "listings", "reports"]).catch("users"), page: z.coerce.number().int().min(1).max(100000).catch(1), seller: z.enum(["0", "1"]).catch("0") });
const size = 20;
export default async function AdminSearch({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const { q, type, page, seller } = querySchema.parse(await searchParams);
  const skip = (page - 1) * size;
  const contains = { contains: q, mode: "insensitive" as const };
  let count = 0;
  let rows: Array<{ id: string; title: string; detail: string; status: string; date: Date }> = [];
  if (type === "users") {
    const where = { OR: [{ name: contains }, { email: contains }, { id: contains }], ...(seller === "1" ? { listings: { some: {} } } : {}) };
    count = await prisma.user.count({ where });
    const users = await prisma.user.findMany({ where, skip, take: size, orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { id: true, name: true, email: true, role: true, createdAt: true, _count: { select: { listings: true } } } });
    rows = users.map(user => ({ id: user.id, title: user.name, detail: user.email, status: `${user.role} · ${user._count.listings} listings`, date: user.createdAt }));
  } else if (type === "listings") {
    const where = { OR: [{ item: contains }, { category: contains }, { id: contains }] };
    count = await prisma.product.count({ where });
    const products = await prisma.product.findMany({ where, skip, take: size, orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { id: true, item: true, category: true, price: true, createdAt: true, owner: { select: { name: true } } } });
    rows = products.map(product => ({ id: product.id, title: product.item, detail: `${product.owner.name} · ${product.category}`, status: `$${product.price.toFixed(2)}`, date: product.createdAt }));
  } else {
    const where = { resolved: false, OR: [{ id: contains }, { reporter: { name: contains } }] };
    count = await prisma.messageReport.count({ where });
    const reports = await prisma.messageReport.findMany({ where, skip, take: size, orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { id: true, createdAt: true, reporter: { select: { name: true } } } });
    rows = reports.map(report => ({ id: report.id, title: "Message report", detail: `Reported by ${report.reporter.name}`, status: "Pending", date: report.createdAt }));
  }
  function pageUrl(next: number) { return "/admin/search?" + new URLSearchParams({ q, type, seller, page: String(next) }); }
  return <><h1 className="text-3xl font-bold">Search records</h1><form className="my-6 flex flex-wrap items-end gap-3"><label className="grid min-w-0 flex-1 gap-1 text-sm">Search<input name="q" defaultValue={q} maxLength={100} className="min-w-0 rounded-lg border border-[#d9cccc] bg-white p-3" /></label><label className="grid gap-1 text-sm">Record type<select name="type" defaultValue={type} className="rounded-lg border border-[#d9cccc] bg-white p-3"><option value="users">Users</option><option value="listings">Listings</option><option value="reports">Pending reports</option></select></label><label className="flex min-h-12 items-center gap-2 text-sm"><input type="checkbox" name="seller" value="1" defaultChecked={seller === "1"} />Sellers only</label><button className="rounded-lg bg-[#20141d] px-5 py-3 font-bold text-white">Search</button></form>
    <p className="mb-4 text-sm text-[#6f626b]">{count.toLocaleString("en")} matching records</p>
    <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead className="border-y border-[#eadfdf] bg-white"><tr><th className="p-3">Record</th><th className="p-3">Details</th><th className="p-3">{type === "listings" ? "Price" : "Status / role"}</th><th className="p-3">Created (UTC)</th><th className="p-3">Action</th></tr></thead><tbody>{rows.map(row => <tr key={row.id} className="border-b border-[#eadfdf]"><td className="p-3"><strong>{row.title}</strong><p className="mt-1 text-xs text-[#6f626b]">{row.id}</p></td><td className="max-w-xs break-words p-3">{row.detail}</td><td className="p-3">{row.status}</td><td className="p-3">{row.date.toISOString().slice(0, 10)}</td><td className="p-3">{type !== "reports" ? <Link className="text-red-700 underline" href={`/admin/delete?type=${type}&id=${row.id}`}>Delete</Link> : <Link className="underline" href="/admin/messages">Message moderation</Link>}</td></tr>)}</tbody></table></div>
    {!rows.length && <p className="py-10 text-center text-[#6f626b]">No matching records.</p>}
    <nav aria-label="Pagination" className="mt-6 flex items-center justify-between gap-3"><span className="text-sm text-[#6f626b]">Page {page} of {Math.max(1, Math.ceil(count / size))}</span><div className="flex gap-5">{page > 1 && <Link className="underline" href={pageUrl(page - 1)}>Previous</Link>}{skip + size < count && <Link className="underline" href={pageUrl(page + 1)}>Next</Link>}</div></nav>
  </>;
}
