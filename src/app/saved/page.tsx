import Link from "next/link";
import { Heart } from "lucide-react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ProductCard } from "@/components/product-card";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { productCardSelect } from "@/lib/market";
import { EmptyState } from "@/components/ui";

export default async function SavedPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=%2Fsaved&notice=save");
  const total = await prisma.favorite.count({ where: { userId: user.id } });
  const raw = Number((await searchParams).page);
  const pages = Math.max(1, Math.ceil(total / 12));
  const page = Number.isInteger(raw) && raw > 0 ? Math.min(raw, pages) : 1;
  const favorites = await prisma.favorite.findMany({ where: { userId: user.id }, select: { product: { select: productCardSelect } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 12, skip: (page - 1) * 12 });
  return <AppShell>
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase text-[#47715f]">Your collection</p><h1 className="mt-2 text-3xl font-bold">Saved Listings</h1><p className="mt-3 text-sm text-[#6f626b]">Products you want to keep an eye on.</p></div><Link href="/market" className="inline-flex min-h-11 items-center text-sm font-semibold underline">Browse Market</Link></header>
    {favorites.length ? <><p className="mb-5 text-sm text-[#6f626b]">{total} saved {total === 1 ? "listing" : "listings"}</p><div className="grid min-w-0 gap-5 sm:grid-cols-2 xl:grid-cols-3">{favorites.map(({ product }) => <ProductCard key={product.id} product={product} viewerId={user.id} saved />)}</div><nav aria-label="Saved listings pagination" className="mt-8 flex flex-wrap justify-between gap-4 text-sm"><span>Page {page} of {pages}</span><div className="flex gap-5">{page > 1 && <Link href={`?page=${page - 1}`} className="underline">Previous</Link>}{page < pages && <Link href={`?page=${page + 1}`} className="underline">Next</Link>}</div></nav></> : <EmptyState icon={<Heart size={28} />} title="No saved listings yet" description="Save listings you want to compare or revisit." href="/market" action="Browse marketplace" />}
  </AppShell>;
}
