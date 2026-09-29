import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { DealControls } from "@/components/deal-controls";
import { DealReview } from "@/components/deal-review";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function DealsPage({ searchParams }: { searchParams: Promise<{ review?: string; message?: string }> }) {
  const [user, params] = await Promise.all([requireUser(), searchParams]);
  const deals = await prisma.deal.findMany({
    where: { OR: [{ buyerId: user.id }, { sellerId: user.id }] },
    include: {
      product: { select: { item: true, status: true } },
      buyer: { select: { name: true } },
      seller: { select: { name: true } },
      reviews: { where: { reviewerId: user.id }, select: { status: true, rating: true, comment: true }, take: 1 },
    },
    orderBy: { createdAt: "desc" },
  });
  return <AppShell><h1 className="text-3xl font-bold">Deals</h1><p className="mt-2 text-sm text-[#6f626b]">Private completion records shared only with the buyer and seller.</p>{params.review === "submitted" && <p role="status" className="mt-5 rounded-lg border border-green-200 bg-green-50 p-3 text-sm font-semibold text-green-800">Review submitted for moderation.</p>}{params.review === "error" && <p role="alert" className="mt-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800">{params.message ?? "Review submission failed."}</p>}{deals.length ? <div className="mt-6 divide-y border-y border-[#eadfdf]">{deals.map(deal => <article key={deal.id} className="py-5"><Link href={`/messages/${deal.conversationId}`} className="font-bold underline">{deal.product.item}</Link><p className="mt-1 text-sm text-[#6f626b]">With {deal.buyerId === user.id ? deal.seller.name : deal.buyer.name}</p>{deal.completedAt && <p className="mt-1 text-xs text-[#6f626b]">Completed {deal.completedAt.toISOString().slice(0, 10)}</p>}<div className="mt-3"><DealControls conversationId={deal.conversationId} viewerId={user.id} sellerId={deal.sellerId} blocked={false} productActive={deal.product.status === "ACTIVE"} deal={deal} /></div><DealReview dealId={deal.id} eligible={deal.status === "COMPLETED" && deal.reviews.length === 0} review={deal.reviews[0]} /></article>)}</div> : <p className="mt-8 border-y border-dashed py-8 text-sm text-[#6f626b]">No deals yet. Sellers can start one from a listing conversation.</p>}</AppShell>;
}
