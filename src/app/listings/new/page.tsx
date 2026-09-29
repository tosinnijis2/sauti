import { AppShell } from "@/components/app-shell";
import { createListingAction } from "@/app/actions/listings";
import { ListingForm } from "@/components/listing-form";

export default async function NewListingPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
  }>;
}) {
  const params = await searchParams;

  return (
    <AppShell>
      <div>
        <h1 className="text-4xl font-black text-[#20141d]">
          Add product
        </h1>

        <p className="mt-2 text-[#6f626b]">
          Add a new product to your Sauti marketplace listings.
        </p>
      </div>

      {params.error && (
        <div className="mt-6 max-w-2xl rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
          {params.error}
        </div>
      )}

      <ListingForm action={createListingAction} submitLabel="Save product" />
    </AppShell>
  );
}
