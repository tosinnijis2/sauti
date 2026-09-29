import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { prisma } from "@/lib/prisma";
import { adminDeleteAction } from "@/app/actions/admin";

export default async function DeleteRecord({ searchParams }: { searchParams: Promise<{ type?: string; id?: string; error?: string }> }) {
  const admin = await requireAdmin();
  const { type, id, error } = await searchParams;
  if (!id || !["users", "listings", "messages"].includes(type ?? "")) notFound();
  let title = "";
  let warning = "";
  let protectedAccount = false;
  if (type === "users") {
    const user = await prisma.user.findUnique({ where: { id }, select: { name: true, email: true, role: true } });
    if (!user) notFound();
    title = `${user.name} (${user.email})`;
    protectedAccount = user.role === "ADMIN" || id === admin.id;
    warning = "This permanently deletes the account, its listings, messages, password reset tokens, reports and conversations, including messages from other participants in those conversations. Existing sessions will stop working. Audit records remain. This cannot be undone.";
  } else if (type === "listings") {
    const product = await prisma.product.findUnique({ where: { id }, select: { item: true } });
    if (!product) notFound();
    title = product.item;
    warning = "This permanently removes the product from the marketplace and the seller's listings. Existing conversations remain, with the listing marked unavailable. This cannot be undone.";
  } else {
    const message = await prisma.message.findFirst({ where: { id, OR: [{ country: { not: null } }, { reports: { some: {} } }] }, select: { id: true, country: true, author: { select: { name: true } } } });
    if (!message) notFound();
    title = `Message ${message.id} by ${message.author.name}`;
    warning = "This permanently deletes the message and its associated reports. The rest of the conversation remains. This cannot be undone.";
  }
  return <section className="max-w-2xl"><Link href="/admin/search" className="text-sm underline">Back to records</Link><h1 className="mt-6 text-2xl font-bold">Confirm permanent deletion</h1><p className="mt-5 break-words font-semibold">{title}</p><p className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900">{warning}</p>{error && <p role="alert" className="mt-4 text-red-700">{error}</p>}{protectedAccount ? <p role="status" className="mt-6">Administrator accounts cannot be deleted here.</p> : <form action={adminDeleteAction} className="mt-6 grid gap-5"><input type="hidden" name="type" value={type} /><input type="hidden" name="id" value={id} /><label className="grid gap-2 text-sm font-semibold">Administrative reason<textarea name="reason" required minLength={10} maxLength={500} rows={3} className="rounded-lg border bg-white p-3" /></label><label className="grid gap-2 text-sm font-semibold">Type DELETE to confirm<input name="confirmation" required pattern="DELETE" autoComplete="off" className="rounded-lg border bg-white p-3" /></label><div className="flex gap-4"><button className="rounded-lg bg-red-700 px-5 py-3 font-bold text-white">Delete permanently</button><Link href="/admin/search" className="px-4 py-3 underline">Cancel</Link></div></form>}</section>;
}
