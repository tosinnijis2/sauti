import Link from "next/link";
import { MapPin, MessageCircle, Pencil } from "lucide-react";
import { contactSeller } from "@/app/actions/chat";
import { ProductImage } from "./product-image";
import { SellerAvatar } from "./seller-avatar";
import { type CardProduct, listedDate } from "@/lib/market";
import { ListingPrice } from "./listing-price";
import { ListingStatusBadge } from "./listing-status";
import { CommodityMetadata } from "./commodity-metadata";
import { countryName } from "@/lib/countries";
import { FavoriteButton } from "./favorite-button";

export function ProductCard({ product, viewerId, saved = false }: { product: CardProduct; viewerId?: string; saved?: boolean }) {
  return <article className="group flex min-w-0 flex-col overflow-hidden rounded-lg border border-[#e1e5e2] bg-white [overflow-wrap:anywhere] transition-shadow hover:shadow-md">
    <div className="relative"><Link href={`/market/${product.id}`} aria-label={`View ${product.item}`} className="block"><ProductImage src={product.imageUrl} alt={product.item} /></Link>{viewerId !== product.ownerId && <div className="absolute right-3 top-3"><FavoriteButton productId={product.id} productName={product.item} saved={saved} signedIn={Boolean(viewerId)} compact /></div>}</div>
    <div className="flex flex-1 flex-col p-4"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-semibold text-[#47715f]">{product.category}</p><ListingStatusBadge status={product.status} /></div><h2 className="mt-2 break-words text-lg font-bold leading-6"><Link href={`/market/${product.id}`} className="hover:underline">{product.item}</Link></h2><div className="mt-3"><ListingPrice product={product} /></div><p className="mt-3 flex items-start gap-1.5 text-sm text-[#6f626b]"><MapPin size={15} className="mt-0.5 shrink-0" /><span className="break-words">{product.location}{product.country ? `, ${countryName(product.country)}` : ""}</span></p>
      <div className="mt-auto pt-5"><Link href={`/sellers/${product.ownerId}`} className="flex min-w-0 items-center gap-2.5"><SellerAvatar name={product.owner.name} imageUrl={product.owner.imageUrl} /><span className="min-w-0"><span className="block truncate text-sm font-semibold">{product.owner.name}</span><time dateTime={product.createdAt.toISOString()} className="block text-xs text-[#6f626b]">Listed {listedDate(product.createdAt)}</time></span></Link>
      {viewerId === product.ownerId ? <Link href={`/listings/${product.id}/edit`} className="mt-4 flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[#ded5da] text-sm font-semibold"><Pencil size={16} />Edit listing</Link> : <form action={contactSeller} className="mt-4"><input type="hidden" name="productId" value={product.id} /><button className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-[#ded5da] text-sm font-semibold transition-colors hover:bg-[#fff0ef]"><MessageCircle size={17} />Message seller</button></form>}</div>
    </div>
    {product.commodity && <div className="border-t border-[#e1e5e2] px-4 py-3"><CommodityMetadata product={product} /></div>}
  </article>;
}
