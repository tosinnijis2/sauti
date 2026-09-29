import Link from "next/link";
import { Pencil } from "lucide-react";
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
          className="inline-flex items-center justify-center rounded-xl bg-[#20141d] px-5 py-3 font-bold text-white no-underline hover:bg-[#342330] visited:text-white"
        >
          Add product
        </Link>
      </div>

      {params.created === "1" && (
        <div className="mt-6 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-800">
          Product added successfully.
        </div>
      )}

      {params.updated === "1" && (
        <div className="mt-6 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-800">
          Product updated successfully.
        </div>
      )}

      {params.deleted === "1" && (
        <div className="mt-6 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-800">
          Product deleted successfully.
        </div>
      )}

      {params.error && (
        <div role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
          {params.error}
        </div>
      )}

      {products.length === 0 ? (
        <div className="mt-10 rounded-3xl border border-dashed border-[#d9cccc] bg-white p-12 text-center">
          <p className="font-semibold text-[#20141d]">
            You haven&apos;t listed any products yet.
          </p>

          <p className="mt-2 text-sm text-[#6f626b]">
            Add your first product to get started.
          </p>

          <Link
            href="/listings/new"
            className="mt-6 inline-flex items-center justify-center rounded-xl bg-[#20141d] px-5 py-3 font-bold text-white no-underline hover:bg-[#342330] visited:text-white"
          >
            Add your first product
          </Link>
        </div>
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
