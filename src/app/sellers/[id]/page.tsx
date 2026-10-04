import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { countryName } from "@/lib/countries";
import { listedDate, productCardSelect } from "@/lib/market";
import { MarketShell } from "@/components/market-shell";
import { ProductCard } from "@/components/product-card";
import { SellerAvatar } from "@/components/seller-avatar";
import { savedProductIds } from "@/lib/favorites";
import { sellerTrustData } from "@/lib/listing-analytics";
import { reportReviewAction } from "@/app/actions/reviews";
import { SafetyReportForm } from "@/components/safety-report-form";

export default async function SellerPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ page?: string; reported?: string; safetyReported?: string; reportError?: string }> }) {
  const { id } = await params; const query = await searchParams; const raw = Number(query.page); const page = Number.isInteger(raw) && raw > 0 && raw <= 100000 ? raw : 1;
  const seller = await sellerTrustData(id); if (!seller) notFound();
  const [listings, reviews, user] = await Promise.all([
    prisma.product.findMany({ where: { ownerId: id, status: "ACTIVE" }, select: productCardSelect, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 12, skip: (page - 1) * 12 }),
    prisma.review.findMany({ where: { targetId: id, status: "PUBLISHED" }, select: { id: true, rating: true, comment: true, createdAt: true, reviewerId: true, deal: { select: { buyerId: true, sellerId: true } } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 20 }),
    getCurrentUser(),
  ]);
  const saved = await savedProductIds(user?.id, listings.map(product => product.id));
  return <MarketShell><Link href="/market" className="text-sm underline">Back to market</Link>
    {query.safetyReported === "1" && <p role="status" className="mt-5 text-sm font-semibold text-[#47715f]">Report submitted for private review.</p>}{query.reportError && <p role="alert" className="mt-5 text-sm font-semibold text-[#9d334b]">{query.reportError}</p>}{query.reported === "1" && <p role="status" className="mt-5 text-sm font-semibold text-[#47715f]">Review reported. The moderation team will assess it.</p>}
    <header className="my-8 flex flex-wrap items-center justify-between gap-4 border-b border-[#eadfdf] pb-7"><div className="flex items-center gap-4"><SellerAvatar name={seller.name} imageUrl={seller.imageUrl} /><div className="min-w-0"><h1 className="break-words text-3xl font-bold">{seller.name}</h1><p className="mt-2 text-sm text-[#6f626b]">{[seller.location, seller.country ? countryName(seller.country) : null].filter(Boolean).join(", ")}</p><p className="mt-2 text-xs text-[#6f626b]">Member since {listedDate(seller.createdAt)} · {seller.emailVerifiedAt ? "Email verified · " : ""}{seller.soldListings} sold listings · {seller.completedDeals} completed deals{seller.medianResponseMinutes != null ? ` · Usually replies within ${Math.max(1, Math.round(seller.medianResponseMinutes / 60))} hours` : ""}</p>{seller.publishedReviewCount > 0 && <p className="mt-2 text-sm font-bold">{seller.averageRating?.toFixed(1)}/5 · {seller.publishedReviewCount} published reviews</p>}</div></div>{user && user.id !== id && <SafetyReportForm targetType="USER" targetId={id} returnTo={`/sellers/${id}`} label="Report this seller" />}</header>
    <h2 className="mb-5 text-xl font-bold">{seller.activeListings} current listings</h2>{listings.length ? <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{listings.map(product => <ProductCard key={product.id} product={product} viewerId={user?.id} saved={saved.has(product.id)} />)}</div> : <p className="py-8 text-[#6f626b]">No listings on this page. <Link href="/market" className="underline">Browse the market</Link></p>}
    <nav aria-label="Seller listings pagination" className="mt-6 flex gap-5 text-sm">{page > 1 && <Link href={`?page=${page - 1}`} className="underline">Previous</Link>}<span>Page {page}</span>{page * 12 < seller.activeListings && <Link href={`?page=${page + 1}`} className="underline">Next</Link>}</nav>
    {reviews.length > 0 && <section className="mt-10 border-t border-[#eadfdf] pt-7"><h2 className="text-xl font-bold">Published reviews</h2><div className="mt-4 divide-y border-y border-[#eadfdf]">{reviews.map(review => <article key={review.id} className="py-4"><div className="flex flex-wrap justify-between gap-2"><p className="font-bold">{review.rating}/5 · {review.reviewerId === review.deal.buyerId ? "Buyer" : "Seller"}</p><time className="text-xs text-[#6f626b]" dateTime={review.createdAt.toISOString()}>{review.createdAt.toISOString().slice(0, 10)}</time></div>{review.comment && <p className="mt-2 whitespace-pre-wrap break-words text-sm text-[#6f626b]">{review.comment}</p>}{user && user.id !== review.reviewerId && <details className="mt-3"><summary className="cursor-pointer text-xs font-semibold underline">Report review</summary><form action={reportReviewAction} className="mt-3 grid max-w-xl gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto]"><input type="hidden" name="reviewId" value={review.id} /><select name="reason" required className="rounded-lg border border-[#d9cccc] px-3 py-2 text-sm"><option value="">Reason</option><option value="HARASSMENT">Harassment</option><option value="SPAM">Spam</option><option value="FALSE_INFORMATION">False information</option><option value="PERSONAL_INFORMATION">Personal information</option><option value="OFF_TOPIC">Off topic</option><option value="OTHER">Other</option></select><input name="note" maxLength={500} placeholder="Optional note" className="rounded-lg border border-[#d9cccc] px-3 py-2 text-sm" /><button className="rounded-lg border border-[#9d334b] px-3 py-2 text-sm font-bold text-[#9d334b]">Submit report</button></form></details>}</article>)}</div></section>}
  </MarketShell>;
}
