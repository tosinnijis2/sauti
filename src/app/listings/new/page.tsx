import { AppShell } from "@/components/app-shell";
import { createListingAction } from "@/app/actions/listings";

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

      <form
        action={createListingAction}
        className="mt-8 grid max-w-2xl gap-5 rounded-3xl border border-[#eadfdf] bg-white p-7"
      >
        <input
          name="item"
          type="text"
          className="rounded-xl border border-[#eadfdf] px-4 py-3 outline-none focus:border-[#fe7a7c]"
          placeholder="Product name"
          required
        />

        <select
          name="category"
          className="rounded-xl border border-[#eadfdf] px-4 py-3 outline-none focus:border-[#fe7a7c]"
          defaultValue=""
          required
        >
          <option value="" disabled>
            Select category
          </option>

          <option value="Animal Products">Animal Products</option>
          <option value="Beans">Beans</option>
          <option value="Cereals">Cereals</option>
          <option value="Fruits">Fruits</option>
          <option value="Vegetables">Vegetables</option>
          <option value="Seeds & Nuts">Seeds & Nuts</option>
          <option value="Roots & Tubers">Roots & Tubers</option>
          <option value="Other">Other</option>
        </select>

        <input
          name="location"
          type="text"
          className="rounded-xl border border-[#eadfdf] px-4 py-3 outline-none focus:border-[#fe7a7c]"
          placeholder="Location"
          required
        />

        <input
          name="price"
          type="number"
          step="0.01"
          min="0"
          className="rounded-xl border border-[#eadfdf] px-4 py-3 outline-none focus:border-[#fe7a7c]"
          placeholder="Price"
          required
        />

        <textarea
          name="description"
          rows={5}
          className="rounded-xl border border-[#eadfdf] px-4 py-3 outline-none focus:border-[#fe7a7c]"
          placeholder="Description"
          required
        />

        <button
          type="submit"
          className="rounded-xl bg-[#20141d] px-5 py-3 font-bold text-white transition hover:bg-[#342330]"
        >
          Save product
        </button>
      </form>
    </AppShell>
  );
}