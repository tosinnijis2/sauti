import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Handshake, MapPin, MessageCircle, Pencil } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { countryName } from "@/lib/countries";
import { listedDate, productCardSelect } from "@/lib/market";
import { ListingPrice } from "@/components/listing-price";
import { ListingStatusBadge } from "@/components/listing-status";
import { CommodityMetadata } from "@/components/commodity-metadata";
import { contactSeller } from "@/app/actions/chat";
import { MarketShell } from "@/components/market-shell";
import { ProductImage } from "@/components/product-image";
import { ProductCard } from "@/components/product-card";
import { SellerAvatar } from "@/components/seller-avatar";
import { ShareButton } from "@/components/share-button";
import { FavoriteButton } from "@/components/favorite-button";
import { savedProductIds } from "@/lib/favorites";
import { ListingViewTracker } from "@/components/listing-view-tracker";
import { SafetyReportForm } from "@/components/safety-report-form";
import { interactionBlockState } from "@/lib/interactions";

export default async function ProductDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ from?: string; safetyReported?: string; reportError?: string }> }) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const returnTo = typeof query.from === "string" && (query.from === "/market" || query.from.startsWith("/market?")) ? query.from : "/market";
  const product = await prisma.product.findUnique({ where: { id }, select: { ...productCardSelect, description: true, owner: { select: { id: true, name: true, imageUrl: true, createdAt: true } } } });
  if (!product) notFound();
  const user = await getCurrentUser();
  const related = await prisma.product.findMany({ where: { id: { not: id }, status: "ACTIVE", category: product.category, ...(product.country ? { country: product.country } : {}) }, select: productCardSelect, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 3 });
  const saved = await savedProductIds(user?.id, [id, ...related.map(item => item.id)]);
  const conversation = user && user.id !== product.ownerId ? await prisma.conversation.findUnique({ where: { productId_buyerId: { productId: id, buyerId: user.id } }, include: { deals: { orderBy: { createdAt: "desc" }, take: 1 } } }) : null;
  const blocked = user && user.id !== product.ownerId ? (await interactionBlockState(user.id, product.ownerId)).blocked : false;
  const latestDeal = conversation?.deals[0];
  const primaryActionClass = "inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#20141d] px-5 text-sm font-bold text-white sm:w-auto";
  const journeyAction = user?.id === product.ownerId ? <Link href={`/listings/${id}/edit`} className={primaryActionClass}><Pencil size={17} />Edit listing</Link> : conversation ? latestDeal && ["PENDING", "BUYER_CONFIRMED", "SELLER_CONFIRMED"].includes(latestDeal.status) ? <Link href={`/messages/${conversation.id}#deal-${latestDeal.id}`} className={primaryActionClass}><Handshake size={18} />View deal</Link> : <Link href={`/messages/${conversation.id}`} className={primaryActionClass}><MessageCircle size={18} />Continue conversation</Link> : product.status !== "ACTIVE" ? <span role="status" className="inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-[#d9cccc] px-5 text-sm font-bold text-[#6f626b] sm:w-auto">Listing unavailable</span> : blocked ? <span role="status" className="inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-[#d9cccc] px-5 text-sm font-bold text-[#6f626b] sm:w-auto">Messaging unavailable</span> : <form action={contactSeller} className="w-full sm:w-auto"><input type="hidden" name="productId" value={id} /><button className={primaryActionClass}><MessageCircle size={18} />Message seller</button></form>;
  return <MarketShell><ListingViewTracker productId={id} />
    {query.safetyReported === "1" && <p role="status" className="mb-4 text-sm font-semibold text-[#47715f]">Report submitted for private review.</p>}{query.reportError && <p role="alert" className="mb-4 text-sm font-semibold text-[#9d334b]">{query.reportError}</p>}
    <Link href={returnTo} className="mb-6 inline-flex min-h-11 items-center gap-2 text-sm font-semibold"><ArrowLeft size={17} />Back to market</Link>
    <div className="grid min-w-0 gap-8 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
      <section aria-label="Product photos" className="min-w-0"><ProductImage src={product.imageUrl} alt={product.item} priority contain sizes="(max-width: 1280px) 100vw, 55vw" /></section>
      <section className="min-w-0"><div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm font-semibold text-[#47715f]">{product.category}</p><ListingStatusBadge status={product.status} /></div><h1 className="mt-3 break-words text-3xl font-bold leading-tight">{product.item}</h1><div className="mt-5"><ListingPrice product={product} large /></div>{product.status !== "ACTIVE" && <p className="mt-3 text-sm font-semibold text-[#872d48]">This listing is not currently active.</p>}<p className="mt-4 flex items-start gap-2 text-sm text-[#6f626b]"><MapPin size={17} className="shrink-0" /><span className="min-w-0 break-words">{product.location}{product.country ? `, ${countryName(product.country)}` : ""}</span></p><p className="mt-3 text-xs text-[#6f626b]">Listed <time dateTime={product.createdAt.toISOString()}>{listedDate(product.createdAt)}</time></p>
        <div className="my-6 border-y border-[#eadfdf] py-5"><Link href={`/sellers/${product.owner.id}`} className="flex items-center gap-3"><SellerAvatar name={product.owner.name} imageUrl={product.owner.imageUrl} /><span className="min-w-0"><strong className="block break-words">{product.owner.name}</strong><span className="mt-1 block text-xs text-[#6f626b]">Member since {listedDate(product.owner.createdAt)}</span></span></Link><Link href={`/sellers/${product.owner.id}`} className="mt-3 inline-block text-sm underline">View seller profile</Link></div>
        <div className="sticky bottom-20 z-20 bg-[#fffaf8] py-3 md:static md:bg-transparent md:py-0">{journeyAction}</div>
        <div className="mt-2 flex flex-wrap items-center gap-3">{user?.id !== product.ownerId && <FavoriteButton productId={id} productName={product.item} signedIn={Boolean(user)} saved={saved.has(id)} />}<ShareButton title={product.item} /></div>
      </section>
    </div>
    {user && user.id !== product.ownerId && <div className="mt-4"><SafetyReportForm targetType="LISTING" targetId={id} returnTo={`/market/${id}`} label="Report this listing" /></div>}
    <section aria-label="Structured commodity details" className="mt-6"><CommodityMetadata product={product} full /></section>
    <section className="my-10 max-w-3xl border-y border-[#eadfdf] py-6"><h2 className="text-lg font-bold">About this listing</h2><p className="mt-4 whitespace-pre-wrap break-words text-sm leading-7 text-[#6f626b]">{product.description}</p></section>
    {related.length > 0 && <section><h2 className="mb-5 text-xl font-bold">More in {product.category}</h2><div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{related.map(item => <ProductCard key={item.id} product={item} viewerId={user?.id} saved={saved.has(item.id)} />)}</div></section>}
  </MarketShell>;
}
