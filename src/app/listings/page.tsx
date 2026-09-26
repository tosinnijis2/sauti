import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function ListingsPage({
  searchParams,
}: {
  searchParams: Promise<{
    created?: string;
  }>;
}) {
  const user = await requireUser();
  const params = await searchParams;

  const products = await prisma.product.findMany({
    where: {
      ownerId: user.id,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

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

      {products.length === 0 ? (
        <div className="mt-10 rounded-3xl border border-dashed border-[#d9cccc] bg-white p-12 text-center">
          <p className="font-semibold text-[#20141d]">
            You haven't listed any products yet.
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
              className="rounded-3xl border border-[#eadfdf] bg-white p-6 shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-[#fe7a7c]">
                    {product.category}
                  </p>

                  <h2 className="mt-2 text-xl font-black text-[#20141d]">
                    {product.item}
                  </h2>
                </div>

                <p className="font-black text-[#20141d]">
                  ${Number(product.price).toFixed(2)}
                </p>
              </div>

              <p className="mt-4 text-sm text-[#6f626b]">
                {product.description}
              </p>

              <p className="mt-5 text-sm font-semibold text-[#20141d]">
                {product.location}
              </p>
            </article>
          ))}
        </div>
      )}
    </AppShell>
  );
}