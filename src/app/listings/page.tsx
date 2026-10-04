import Link from "next/link";
import { PackagePlus, Pencil } from "lucide-react";
import { deleteListingAction } from "@/app/actions/listings";
import { AppShell } from "@/components/app-shell";
import { DeleteListingButton } from "@/components/delete-listing-button";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ProductImage } from "@/components/product-image";
import { ListingPrice } from "@/components/listing-price";
import { ListingStatusBadge } from "@/components/listing-status";
import { ListingStatusControl } from "@/components/listing-status-control";
import { CommodityMetadata } from "@/components/commodity-metadata";
import { listingAnalytics } from "@/lib/listing-analytics";
import { listedDate } from "@/lib/market";
import { Alert, EmptyState, primaryButtonClass } from "@/components/ui";

export default async function ListingsPage({
  searchParams,
}: {
  searchParams: Promise<{
    created?: string;
    updated?: string;
    deleted?: string;
    error?: string;
  }>;
}) {
  const user = await requireUser();
  const params = await searchParams;

  const [products, analytics] = await Promise.all([prisma.product.findMany({
    where: {
      ownerId: user.id,
    },
    orderBy: {
      createdAt: "desc",
    },
  }), listingAnalytics(user.id)]);
  const analyticsById = new Map(analytics.map(item => [item.id, item]));

  return (
    <AppShell>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black text-[#20141d]">
            My listings
          </h1>

          <p className="mt-2 text-[#6f626b]">
            Manage the products you have listed on Sauti.
          </p>
        </div>

        <Link
          href="/listings/new"
          className={primaryButtonClass}
        >
          Add product
        </Link>
      </div>

      {params.created === "1" && (
        <div className="mt-6"><Alert tone="success">Product added successfully.</Alert></div>
      )}

      {params.updated === "1" && (
        <div className="mt-6"><Alert tone="success">Product updated successfully.</Alert></div>
      )}

      {params.deleted === "1" && (
        <div className="mt-6"><Alert tone="success">Product deleted successfully.</Alert></div>
      )}

      {params.error && (
        <div className="mt-6"><Alert>{params.error}</Alert></div>
      )}

      {products.length === 0 ? (
        <div className="mt-10"><EmptyState icon={<PackagePlus size={28} />} title="No listings yet" description="Create your first listing and make it available to buyers." href="/listings/new" action="Create first listing" /></div>
      ) : (
        <div className="mt-10 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {products.map((product) => (
            <article
              key={product.id}
              className="min-w-0 rounded-lg border border-[#eadfdf] bg-white p-4 shadow-sm"
            >
              <Link href={`/market/${product.id}`} className="mb-4 block overflow-hidden rounded-lg" aria-label={`View ${product.item}`}><ProductImage src={product.imageUrl} alt={product.item} /></Link>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-[#fe7a7c]">
                    {product.category}
                  </p>

                  <h2 className="mt-2 text-xl font-black text-[#20141d]">
                    {product.item}
                  </h2>
                </div>

                <ListingStatusBadge status={product.status} />
              </div>
              <div className="mt-4"><ListingPrice product={product} /></div>
              <CommodityMetadata product={product} />
              {!product.commodity && <Link href={`/listings/${product.id}/edit`} className="mt-2 inline-block text-sm underline">Add commodity details</Link>}
              {!product.quantity && <Link href={`/listings/${product.id}/edit`} className="mt-2 inline-block text-sm underline">Add quantity and unit</Link>}
              <ListingStatusControl productId={product.id} status={product.status} />

              <p className="mt-4 text-sm text-[#6f626b]">
                {product.description}
              </p>

              <p className="mt-5 text-sm font-semibold text-[#20141d]">
                {product.location}
              </p>
              {analyticsById.has(product.id) && <p className="mt-3 text-xs text-[#6f626b]">{analyticsById.get(product.id)!.views} views · {analyticsById.get(product.id)!.saves} saves · {analyticsById.get(product.id)!.conversations} buyer conversations · Listed {listedDate(product.createdAt)}</p>}

              <div className="mt-6 flex items-center gap-2 border-t border-[#eadfdf] pt-4">
                <Link
                  href={`/listings/${product.id}/edit`}
                  className="inline-flex items-center gap-2 rounded-lg border border-[#d9cccc] px-3 py-2 text-sm font-bold text-[#20141d] hover:bg-[#fff4f1]"
                >
                  <Pencil size={16} />
                  Edit
                </Link>
                <DeleteListingButton action={deleteListingAction.bind(null, product.id)} />
              </div>
            </article>
          ))}
        </div>
      )}
    </AppShell>
  );
}
