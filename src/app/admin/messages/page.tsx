import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import { prisma } from "@/lib/prisma";

export default async function AdminMessages({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await requireAdmin();
  const raw = Number((await searchParams).page);
  const page = Number.isInteger(raw) && raw > 0 && raw <= 100000 ? raw : 1;
  const where = { OR: [{ country: { not: null } }, { reports: { some: {} } }] };
  const count = await prisma.message.count({ where });
  const messages = await prisma.message.findMany({ where, skip: (page - 1) * 20, take: 20, orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { id: true, country: true, createdAt: true, author: { select: { name: true } }, _count: { select: { reports: true } } } });
  return <><h1 className="text-3xl font-bold">Message moderation</h1><p className="mt-3 text-sm text-[#6f626b]">Public-room messages and reported private messages. Private content is not displayed.</p><div className="mt-6 overflow-x-auto"><table className="w-full min-w-[600px] text-left text-sm"><thead><tr><th className="p-3">Message / author</th><th>Channel</th><th>Reports</th><th>Created (UTC)</th><th>Action</th></tr></thead><tbody>{messages.map(message => <tr key={message.id} className="border-t"><td className="p-3">{message.author.name}<p className="text-xs text-[#6f626b]">{message.id}</p></td><td>{message.country ?? "Reported private message"}</td><td>{message._count.reports}</td><td>{message.createdAt.toISOString().slice(0, 16).replace("T", " ")}</td><td><Link className="text-red-700 underline" href={`/admin/delete?type=messages&id=${message.id}`}>Delete</Link></td></tr>)}</tbody></table></div>{!messages.length && <p className="py-8">No messages eligible for moderation.</p>}<nav aria-label="Pagination" className="mt-6 flex gap-5">{page > 1 && <Link href={`?page=${page - 1}`}>Previous</Link>}<span>Page {page}</span>{page * 20 < count && <Link href={`?page=${page + 1}`}>Next</Link>}</nav></>;
}
