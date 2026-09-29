import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { CountrySelect } from "@/components/country-select";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { countryName } from "@/lib/countries";
import { blockUser } from "@/app/actions/chat";

export default async function MessagesPage({ searchParams }: { searchParams: Promise<{ country?: string; error?: string; reported?: string }> }) {
  const user = await requireUser();
  const params = await searchParams;
  const conversations = await prisma.conversation.findMany({ where: { OR: [{ buyerId: user.id }, { sellerId: user.id }], ...(params.country ? { product: { country: params.country } } : {}) }, include: { buyer: { select: { name: true } }, seller: { select: { name: true } }, product: { select: { country: true } } }, orderBy: { updatedAt: "desc" } });
  const blocks = await prisma.userBlock.findMany({ where: { blockerId: user.id }, include: { blocked: { select: { name: true } } } });
  return <AppShell><h1 className="text-3xl font-bold">Messages</h1><nav className="my-6 flex flex-wrap gap-6 border-b pb-4"><Link href="/messages" aria-current="page" className="font-bold underline">Private conversations</Link><Link href="/messages/rooms">Country rooms</Link>{user.role === "ADMIN" && <Link href="/messages/moderation">Reports</Link>}</nav>
    {params.error && <p role="alert" className="text-red-700">{params.error}</p>}{params.reported && <p role="status">Your report has been submitted.</p>}
    <form className="flex flex-wrap items-end gap-3"><CountrySelect optional defaultValue={params.country} /><button className="rounded-lg bg-[#20141d] px-5 py-3 text-white">Filter by listing country</button></form>
    <div className="mt-6 divide-y border-y">{conversations.map(c => <Link key={c.id} href={"/messages/" + c.id} className="block py-5 hover:bg-white"><strong className="break-words">{c.productName}</strong><p className="mt-1 text-sm">{c.buyerId === user.id ? c.seller.name : c.buyer.name} · {countryName(c.product?.country)}</p></Link>)}</div>
    {!conversations.length && <p className="py-8">No conversations found. <Link href="/market" className="underline">Browse products</Link></p>}
    {blocks.length > 0 && <section className="mt-8"><h2 className="font-bold">Blocked accounts</h2>{blocks.map(b => <form key={b.blockedId} action={blockUser} className="flex items-center justify-between gap-4 border-b py-3"><span>{b.blocked.name}</span><input type="hidden" name="userId" value={b.blockedId} /><input type="hidden" name="unblock" value="1" /><button className="underline">Unblock</button></form>)}</section>}
  </AppShell>;
}
