import Link from "next/link";
import { Bell, Check, CheckCheck } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { listedDate } from "@/lib/market";
import { markAllNotificationsReadAction, markNotificationReadAction } from "@/app/actions/notifications";
import { EmptyState } from "@/components/ui";

const PAGE_SIZE = 25;

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const user = await requireUser();
  const rawPage = Number((await searchParams).page);
  const [total, unread] = await Promise.all([prisma.notification.count({ where: { userId: user.id } }), prisma.notification.count({ where: { userId: user.id, readAt: null } })]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Number.isInteger(rawPage) && rawPage > 0 ? Math.min(rawPage, pages) : 1;
  const notifications = await prisma.notification.findMany({ where: { userId: user.id }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE });
  return <AppShell><header className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase text-[#47715f]">Updates</p><h1 className="mt-2 text-3xl font-bold">Notifications</h1><p className="mt-3 text-sm text-[#6f626b]">Private price alerts and marketplace updates.</p></div>{unread > 0 && <form action={markAllNotificationsReadAction}><button className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[#d9cccc] bg-white px-4 text-sm font-bold"><CheckCheck size={18} />Mark all read</button></form>}</header>
    {notifications.length ? <><div className="mt-7 divide-y divide-[#eadfdf] border-y border-[#eadfdf]">{notifications.map(item => <article key={item.id} className={`py-5 ${item.readAt ? "opacity-70" : ""}`}><div className="flex items-start gap-3"><span className={`mt-1 grid size-9 shrink-0 place-items-center rounded-full ${item.readAt ? "bg-[#eadfdf]" : "bg-[#ffe1df] text-[#9d334b]"}`}><Bell size={17} /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-start justify-between gap-2"><h2 className="font-bold">{item.title}</h2><time className="text-xs text-[#6f626b]" dateTime={item.createdAt.toISOString()}>{listedDate(item.createdAt)}</time></div><p className="mt-2 break-words text-sm text-[#6f626b]">{item.message}</p><div className="mt-3 flex flex-wrap gap-4 text-sm">{item.href && <Link href={item.href} className="font-semibold text-[#47715f] underline">{item.type === "PRICE_ALERT" ? "View Market Insights" : item.type === "NEW_LISTING_MATCH" ? "View matching listings" : "View details"}</Link>}{!item.readAt && <form action={markNotificationReadAction}><input type="hidden" name="id" value={item.id} /><button className="inline-flex items-center gap-1 font-semibold underline"><Check size={15} />Mark read</button></form>}</div></div></div></article>)}</div><nav aria-label="Notification pagination" className="mt-6 flex items-center justify-between gap-4 text-sm"><span>Page {page} of {pages} · {total} notifications</span><div className="flex gap-5">{page > 1 && <Link href={`?page=${page - 1}`} className="font-semibold underline">Previous</Link>}{page < pages && <Link href={`?page=${page + 1}`} className="font-semibold underline">Next</Link>}</div></nav></> : <div className="mt-8"><EmptyState icon={<Bell size={28} />} title="No notifications yet" description="Messages, deal updates, price watches, and saved-search matches will appear here." href="/market" action="Browse marketplace" /></div>}
  </AppShell>;
}
