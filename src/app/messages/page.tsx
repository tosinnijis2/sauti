import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { CountrySelect } from "@/components/country-select";
import { ProductImage } from "@/components/product-image";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { countryName } from "@/lib/countries";
import { blockUser } from "@/app/actions/chat";
import { Avatar } from "@/components/avatar";
import { EmptyState } from "@/components/ui";

const PAGE_SIZE = 20;
const activeDeals = ["PENDING", "BUYER_CONFIRMED", "SELLER_CONFIRMED"] as const;

function pageHref(params: Record<string, string | undefined>, page: number) {
  const query = new URLSearchParams(Object.entries({ ...params, page: String(page) }).filter((entry): entry is [string, string] => Boolean(entry[1])));
  return `/messages?${query}`;
}

export default async function MessagesPage({ searchParams }: { searchParams: Promise<{ country?: string; error?: string; reported?: string; filter?: string; q?: string; page?: string }> }) {
  const user = await requireUser();
  const params = await searchParams;
  const filter = ["unread", "active", "completed"].includes(params.filter ?? "") ? params.filter : "";
  const q = String(params.q ?? "").trim().slice(0, 100);
  const rawPage = Number(params.page);
  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;
  const membership = { OR: [{ buyerId: user.id }, { sellerId: user.id }] };
  const where = {
    AND: [membership, params.country ? { product: { country: params.country } } : {}, q ? { OR: [{ productName: { contains: q, mode: "insensitive" as const } }, { buyer: { name: { contains: q, mode: "insensitive" as const } } }, { seller: { name: { contains: q, mode: "insensitive" as const } } }] } : {},
      filter === "unread" ? { OR: [{ buyerId: user.id, buyerUnreadCount: { gt: 0 } }, { sellerId: user.id, sellerUnreadCount: { gt: 0 } }] } : {},
      filter === "active" ? { deals: { some: { status: { in: [...activeDeals] } } } } : {},
      filter === "completed" ? { deals: { some: { status: "COMPLETED" as const } } } : {},
    ],
  };
  const [total, conversations, blocks] = await Promise.all([
    prisma.conversation.count({ where }),
    prisma.conversation.findMany({ where, include: { buyer: { select: { name: true, imageUrl: true } }, seller: { select: { name: true, imageUrl: true } }, product: { select: { country: true, imageUrl: true, status: true } }, messages: { where: { hidden: false }, select: { body: true, createdAt: true, authorId: true }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 1 }, deals: { select: { status: true }, orderBy: { createdAt: "desc" }, take: 1 } }, orderBy: [{ updatedAt: "desc" }, { id: "desc" }], skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    prisma.userBlock.findMany({ where: { blockerId: user.id }, include: { blocked: { select: { name: true } } } }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  return <AppShell><h1 className="text-3xl font-bold">Messages</h1><nav className="my-6 flex flex-wrap gap-6 border-b pb-4"><Link href="/messages" aria-current="page" className="font-bold underline">Private conversations</Link><Link href="/messages/rooms">Country rooms</Link>{user.role === "ADMIN" && <Link href="/messages/moderation">Reports</Link>}</nav>
    {params.error && <p role="alert" className="text-red-700">{params.error}</p>}{params.reported && <p role="status">Your report has been submitted.</p>}
    <form className="grid gap-3 border-y border-[#eadfdf] py-4 sm:grid-cols-2 lg:grid-cols-4"><label className="grid gap-2 text-sm font-bold">Search conversations<input name="q" defaultValue={q} maxLength={100} placeholder="Listing or person" className="min-h-11 rounded-lg border border-[#d9cccc] bg-white px-3 font-normal" /></label><CountrySelect optional defaultValue={params.country} /><label className="grid gap-2 text-sm font-bold">Show<select name="filter" defaultValue={filter} className="min-h-11 rounded-lg border border-[#d9cccc] bg-white px-3 font-normal"><option value="">All conversations</option><option value="unread">Unread</option><option value="active">Active deals</option><option value="completed">Completed deals</option></select></label><button className="mt-auto min-h-11 rounded-lg bg-[#20141d] px-5 text-sm font-bold text-white">Apply</button></form>
    <p className="mt-5 text-sm text-[#6f626b]">{total} {total === 1 ? "conversation" : "conversations"}</p>
    <div className="mt-3 divide-y border-y border-[#eadfdf]">{conversations.map(c => {
      const other = c.buyerId === user.id ? c.seller : c.buyer;
      const unread = c.buyerId === user.id ? c.buyerUnreadCount : c.sellerUnreadCount;
      const last = c.messages[0];
      const dealStatus = c.deals[0]?.status;
      return <Link key={c.id} href={`/messages/${c.id}`} className={`grid min-w-0 grid-cols-[72px_1fr] gap-4 py-4 transition-colors hover:bg-white sm:grid-cols-[84px_1fr_auto] ${unread ? "font-semibold" : ""}`}><div className="overflow-hidden rounded-lg"><ProductImage src={c.product?.imageUrl} alt={c.productName} sizes="84px" /></div><div className="min-w-0"><div className="flex min-w-0 items-center gap-2"><Avatar name={other.name} imageUrl={other.imageUrl} size="sm" /><span className="truncate">{other.name}</span>{unread > 0 && <span className="rounded-full bg-[#fe7a7c] px-2 py-0.5 text-xs font-bold">{unread}</span>}</div><h2 className="mt-2 truncate font-bold">{c.productName}</h2><p className="mt-1 truncate text-sm font-normal text-[#6f626b]">{last ? `${last.authorId === user.id ? "You: " : ""}${last.body}` : "No messages yet"}</p><p className="mt-1 text-xs font-normal text-[#8b7d85]">{countryName(c.product?.country)}{c.product ? ` · ${c.product.status}` : " · Listing removed"}</p></div><div className="col-span-2 flex items-center justify-between gap-3 text-xs font-normal text-[#6f626b] sm:col-span-1 sm:flex-col sm:items-end"><time dateTime={(last?.createdAt ?? c.updatedAt).toISOString()}>{new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(last?.createdAt ?? c.updatedAt)}</time>{dealStatus && <span className="rounded-full border border-[#d9cccc] bg-white px-2 py-1 font-bold">{dealStatus.replaceAll("_", " ")}</span>}</div></Link>;
    })}</div>
    {!conversations.length && <EmptyState title={filter || q || params.country ? "No conversations match these filters" : "No conversations yet"} description={filter || q || params.country ? "Clear or adjust the filters to see more conversations." : "Find something you are interested in and message the seller."} href={filter || q || params.country ? "/messages" : "/market"} action={filter || q || params.country ? "Clear filters" : "Browse marketplace"} />}
    {total > 0 && <nav aria-label="Conversation pagination" className="mt-6 flex items-center justify-between text-sm"><span>Page {Math.min(page, pages)} of {pages}</span><div className="flex gap-5">{page > 1 && <Link href={pageHref(params, page - 1)} className="font-bold underline">Previous</Link>}{page < pages && <Link href={pageHref(params, page + 1)} className="font-bold underline">Next</Link>}</div></nav>}
    {blocks.length > 0 && <section className="mt-8"><h2 className="font-bold">Blocked accounts</h2>{blocks.map(b => <form key={b.blockedId} action={blockUser} className="flex items-center justify-between gap-4 border-b py-3"><span>{b.blocked.name}</span><input type="hidden" name="userId" value={b.blockedId} /><input type="hidden" name="unblock" value="1" /><button className="underline">Unblock</button></form>)}</section>}
  </AppShell>;
}
