import { notFound } from "next/navigation";
import { updateListingAction } from "@/app/actions/listings";
import { AppShell } from "@/components/app-shell";
import { ListingForm } from "@/components/listing-form";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function EditListingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const [user, routeParams, query] = await Promise.all([
    requireUser(),
    params,
    searchParams,
  ]);
  const product = await prisma.product.findFirst({
    where: { id: routeParams.id, ownerId: user.id },
  });

  if (!product) notFound();

  const action = updateListingAction.bind(null, product.id);

  return (
    <AppShell>
      <h1 className="text-4xl font-black text-[#20141d]">Edit product</h1>
      <p className="mt-2 text-[#6f626b]">Update the details buyers see in the marketplace.</p>

      {query.error && (
        <div role="alert" className="mt-6 max-w-2xl rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
          {query.error}
        </div>
      )}

      <ListingForm
        action={action}
        productId={product.id}
        submitLabel="Save changes"
        defaults={{
          imageUrl: product.imageUrl,
          country: product.country,
          item: product.item,
          category: product.category,
          location: product.location,
          price: product.price.toString(),
          quantity: product.quantity?.toString(),
          unit: product.unit,
          status: product.status,
          commodity: product.commodity,
          variety: product.variety,
          grade: product.grade,
          packageQuantity: product.packageQuantity?.toString(),
          packageUnit: product.packageUnit,
          description: product.description,
        }}
      />
    </AppShell>
  );
}
