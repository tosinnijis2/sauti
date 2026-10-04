import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ChatPanel } from "@/components/chat-panel";
import { requireUser } from "@/lib/auth";
import { canReadConversation, markConversationRead } from "@/lib/chat";
import { countryName } from "@/lib/countries";
import { prisma } from "@/lib/prisma";
import { DealControls } from "@/components/deal-controls";
import { Avatar } from "@/components/avatar";
import { ProductImage } from "@/components/product-image";
import { DealTimeline } from "@/components/deal-timeline";
import { formatPrice } from "@/lib/market";
import { quantityLabel } from "@/lib/units";
import { interactionBlockState } from "@/lib/interactions";
import { blockUser } from "@/app/actions/chat";
import { DealReview } from "@/components/deal-review";
import { canReview } from "@/lib/deals";

export default async function ConversationPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ dealError?: string; safetyReported?: string; reportError?: string }> }) {
  const user = await requireUser();
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const c = await canReadConversation(id, user.id);
  if (!c) notFound();
  const otherId = c.buyerId === user.id ? c.sellerId : c.buyerId;
  const [blockState, deals] = await Promise.all([interactionBlockState(user.id, otherId), prisma.deal.findMany({ where: { conversationId: id }, include: { reviews: { where: { reviewerId: user.id }, select: { status: true, rating: true, comment: true }, take: 1 } }, orderBy: { createdAt: "desc" } }), markConversationRead(id, user.id)]);
  const blocked = blockState.blocked;
  const deal = deals.find(item => ["PENDING", "BUYER_CONFIRMED", "SELLER_CONFIRMED"].includes(item.status)) ?? deals[0] ?? null;
  const other = c.buyerId === user.id ? c.seller : c.buyer;
  const reviewEligible = Boolean(deal && !blocked && await canReview(user.id, deal.id, otherId));
  return <AppShell>
    <Link href="/messages" className="inline-flex min-h-11 items-center gap-2 text-sm font-bold underline"><ArrowLeft size={17} />All conversations</Link>
    {query.dealError && <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{query.dealError}</p>}
    {query.safetyReported === "1" && <p role="status" className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">Report submitted for private review.</p>}
    {query.reportError && <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{query.reportError}</p>}
    <header className="mt-6 flex flex-wrap items-center justify-between gap-4"><div className="flex items-center gap-3"><Avatar name={other.name} imageUrl={other.imageUrl} size="lg" /><div><h1 className="break-words text-3xl font-bold">{c.productName}</h1><p className="mt-1">Conversation with {other.name}</p></div></div><form action={blockUser}><input type="hidden" name="userId" value={otherId} />{blockState.viewerBlocked && <input type="hidden" name="unblock" value="1" />}<button className="min-h-10 text-sm font-bold text-[#9d334b] underline">{blockState.viewerBlocked ? "Unblock user" : "Block user"}</button></form></header>
    {blockState.viewerBlocked ? <p className="mt-4 text-sm font-semibold">You blocked this user.</p> : blocked ? <p className="mt-4 text-sm text-[#6f626b]">Messaging and new interactions are unavailable for this conversation.</p> : null}
    {c.product ? <section className="mt-5 grid grid-cols-[96px_1fr] gap-4 border-y border-[#eadfdf] py-4"><Link href={`/market/${c.productId}`} className="overflow-hidden rounded-lg"><ProductImage src={c.product.imageUrl} alt={c.product.item} sizes="96px" /></Link><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><Link href={`/market/${c.productId}`} className="truncate font-bold underline">{c.product.item}</Link><span className="rounded-full border border-[#d9cccc] px-2 py-0.5 text-xs font-bold">{c.product.status}</span></div><p className="mt-2 text-sm">{formatPrice(c.product.price)} USD asking{c.product.quantity && c.product.unit ? ` for ${quantityLabel(c.product.quantity, c.product.unit)}` : ""}</p><p className="mt-1 text-sm text-[#6f626b]">{c.product.remainingQuantity != null && c.product.unit ? `${quantityLabel(c.product.remainingQuantity, c.product.unit)} available · ` : ""}{countryName(c.product.country)}</p></div></section> : <p className="mt-3 border-y border-[#eadfdf] py-4">This listing is no longer available. Conversation history remains accessible.</p>}
    <ChatPanel key={id} userId={user.id} conversationId={id} disabled={blocked} />
    <section className="my-7" aria-labelledby="deal-heading"><h2 id="deal-heading" className="mb-3 text-xl font-bold">Deal</h2><DealControls conversationId={id} viewerId={user.id} sellerId={c.sellerId} sellerName={c.seller.name} listingName={c.productName} blocked={blocked} productActive={c.product?.status === "ACTIVE"} available={c.product?.remainingQuantity ?? c.product?.quantity} unit={c.product?.unit} askingPrice={c.product?.price} askingQuantity={c.product?.quantity} deal={deal} /></section>
    {deal && <DealTimeline deal={deal} />}
    {deal?.status === "COMPLETED" && <section className="my-5"><DealReview dealId={deal.id} eligible={reviewEligible} review={deal.reviews[0]} /></section>}
  </AppShell>;
}
