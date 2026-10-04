import Link from "next/link";
import { ArrowRight, BarChart3, Camera, Heart, MailCheck, Plus, Search, Store } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ProductCard } from "@/components/product-card";
import { SellerAvatar } from "@/components/seller-avatar";
import { MarketSnapshot } from "@/components/market-snapshot";
import { requireUser } from "@/lib/auth";
import { dashboardData } from "@/lib/dashboard";
import { countryName } from "@/lib/countries";
import { listedDate, type CardProduct } from "@/lib/market";
import { Avatar } from "@/components/avatar";
import { CompletedDealSnapshot } from "@/components/completed-deal-snapshot";
import { Card } from "@/components/ui";

function ListingsSection({ title, href, linkLabel, products, userId, saved, empty }: {
  title: string; href: string; linkLabel: string; products: CardProduct[]; userId: string; saved?: Set<string>; empty: string;
}) {
  return <section className="mt-10" aria-label={title}>
    <header className="mb-5 flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-bold">{title}</h2><Link href={href} className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[#47715f] hover:underline">{linkLabel}<ArrowRight size={16} aria-hidden="true" /></Link></header>
    {products.length ? <div className="grid min-w-0 gap-5 sm:grid-cols-2 xl:grid-cols-3">{products.map(product => <ProductCard key={product.id} product={product} viewerId={userId} saved={saved?.has(product.id)} />)}</div> : <p className="border-y border-dashed border-[#ded5da] py-6 text-sm text-[#6f626b]">{empty}</p>}
  </section>;
}

export default async function DashboardPage() {
  const user = await requireUser();
  const data = await dashboardData(user.id, user.country);
  const hasActivity = data.listingCount + data.savedCount + data.conversationCount > 0;
  const name = user.name.trim().split(/\s+/)[0];
  const actions = [
    { href: "/listings/new", label: "Sell Something", icon: Plus },
    { href: "/market", label: "Browse Market", icon: Store },
    { href: "/market/insights", label: "Market Insights", icon: BarChart3 },
    { href: "/saved", label: "Saved Listings", icon: Heart },
  ];
  const stats = [
    { label: "Unread conversations", count: data.marketplaceActivity.unreadConversations, href: "/messages?filter=unread" },
    { label: "Waiting for confirmation", count: data.marketplaceActivity.waitingConfirmations, href: "/deals?focus=waiting" },
    { label: "Ready for review", count: data.marketplaceActivity.reviewEligible, href: "/deals?focus=review" },
    { label: "Active listings", count: data.marketplaceActivity.activeListings, href: "/listings" },
  ];
  const setupTasks = [
    !user.imageUrl && { href: "/profile", label: "Add a profile photo", description: "Help people recognize you.", icon: Camera },
    !user.emailVerifiedAt && { href: "/profile", label: "Verify your email", description: "Enable email price alerts.", icon: MailCheck },
    data.listingCount === 0 && { href: "/listings/new", label: "Create your first listing", description: "Share what you have available.", icon: Plus },
    data.savedSearchCount === 0 && { href: "/market", label: "Save a useful search", description: "Return to the same market filters.", icon: Search },
  ].filter(Boolean) as Array<{ href: string; label: string; description: string; icon: typeof Camera }>;
  return <AppShell>
    <header className="flex items-center gap-4"><Avatar name={user.name} imageUrl={user.imageUrl} size="lg" /><div><p className="text-xs font-bold uppercase text-[#47715f]">Your Sauti</p><h1 className="mt-1 break-words text-3xl font-bold">{hasActivity ? "Welcome back" : "Welcome to Sauti"}{name ? `, ${name}` : ""}</h1><p className="mt-2 text-sm text-[#6f626b]">{hasActivity ? "Your listings, saved finds, and conversations at a glance." : "Explore the market or list something for sale to get started."}</p></div></header>
    {setupTasks.length > 0 && <Card className="mt-7"><div className="flex flex-wrap items-end justify-between gap-2"><div><p className="text-xs font-bold uppercase text-[#47715f]">Get set up</p><h2 className="mt-1 text-xl font-bold">A few useful next steps</h2></div><span className="text-sm text-[#6f626b]">{setupTasks.length} remaining</span></div><div className="mt-4 grid gap-2 sm:grid-cols-2">{setupTasks.map(({ href, label, description, icon: Icon }) => <Link key={label} href={href} className="group flex min-h-16 items-center gap-3 rounded-lg border border-[#eadfdf] p-3 transition-colors hover:border-[#fe7a7c] hover:bg-[#fffaf8]"><span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#ffe0df]"><Icon size={19} /></span><span className="min-w-0"><span className="block text-sm font-bold group-hover:underline">{label}</span><span className="block text-xs text-[#6f626b]">{description}</span></span><ArrowRight size={16} className="ml-auto shrink-0" /></Link>)}</div></Card>}
    <section className="my-7"><h2 className="text-sm font-bold uppercase text-[#6f626b]">Quick actions</h2><nav aria-label="Quick actions" className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{actions.map(({ href, label, icon: Icon }, index) => <Link key={href} href={href} className={`flex min-h-20 items-center gap-3 rounded-lg border px-4 text-sm font-bold transition hover:-translate-y-0.5 ${index === 0 ? "border-[#20141d] bg-[#20141d] text-white" : "border-[#eadfdf] bg-white text-[#20141d]"}`}><span className={`grid size-10 place-items-center rounded-full ${index === 0 ? "bg-[#fe7a7c] text-[#20141d]" : "bg-[#ffe0df]"}`}><Icon size={19} /></span>{label}</Link>)}</nav></section>
    {hasActivity && <section aria-label="Your marketplace activity" className="grid grid-cols-1 divide-y divide-[#eadfdf] border-y border-[#eadfdf] sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4">{stats.map(stat => <Link key={stat.href} href={stat.href} className="flex items-center justify-between gap-3 px-4 py-5 transition-colors hover:bg-white"><span className="text-sm text-[#6f626b]">{stat.label}</span><span className="text-2xl font-bold tabular-nums">{stat.count}</span></Link>)}</section>}
    {data.sellerPerformance.active > 0 && <section aria-label="Your selling activity" className="mt-8 border-y border-[#eadfdf] py-5"><h2 className="text-xl font-bold">Your selling activity</h2><p className="mt-3 text-sm text-[#6f626b]">{data.sellerPerformance.active} active listings · {data.sellerPerformance.views} total views · {data.sellerPerformance.saves} saves · {data.sellerPerformance.conversations} buyer conversations</p></section>}

    {data.conversations.length > 0 && <section aria-label="Continue conversations" className="mt-8"><header className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-bold">Continue conversations</h2><Link href="/messages" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[#47715f]">Open inbox<ArrowRight size={16} /></Link></header><div className="divide-y border-y border-[#eadfdf]">{data.conversations.map(conversation => {
      const participant = conversation.buyerId === user.id ? conversation.seller : conversation.buyer;
      const latest = conversation.messages[0];
      return <Link key={conversation.id} href={`/messages/${conversation.id}`} className="flex min-w-0 items-start gap-3 py-4 hover:bg-white"><SellerAvatar name={participant.name} imageUrl={participant.imageUrl} /><div className="min-w-0 flex-1"><div className="flex flex-wrap justify-between gap-x-3 gap-y-1"><span className="break-words text-sm font-bold">{participant.name}</span>{latest && <time dateTime={latest.createdAt.toISOString()} className="text-xs text-[#6f626b]">{listedDate(latest.createdAt)}</time>}</div><p className="mt-1 truncate text-xs text-[#47715f]">{conversation.productName}</p><p className="mt-1 line-clamp-2 break-words text-sm text-[#6f626b]">{latest?.body ?? "No visible messages yet."}</p></div><ArrowRight size={17} className="mt-2 shrink-0" aria-hidden="true" /></Link>;
    })}</div></section>}

    {hasActivity && <ListingsSection title="Your Listings" href="/listings" linkLabel="View all listings" products={data.listings} userId={user.id} empty="You haven't listed anything yet." />}
    {hasActivity && <ListingsSection title="Saved for Later" href="/saved" linkLabel="View all saved" products={data.favorites.map(favorite => favorite.product)} userId={user.id} saved={new Set(data.favorites.map(favorite => favorite.product.id))} empty="Your saved collection is waiting for its first find." />}
    <MarketSnapshot userId={user.id} />
    <CompletedDealSnapshot />
    <ListingsSection title="Fresh on Sauti" href="/market" linkLabel="Browse all" products={data.fresh} userId={user.id} saved={data.saved} empty="No new listings from other sellers yet." />
    {data.community.length > 0 && <section aria-label="From your community" className="mt-10"><header className="mb-3 flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-bold">From your community</h2><Link href={`/messages/rooms?country=${encodeURIComponent(user.country ?? "")}`} className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[#47715f]">{countryName(user.country)} room<ArrowRight size={16} /></Link></header><div className="divide-y border-y border-[#eadfdf]">{data.community.map(message => <article key={message.id} className="py-4"><div className="flex flex-wrap justify-between gap-2"><h3 className="break-words text-sm font-bold">{message.author.name}</h3><time dateTime={message.createdAt.toISOString()} className="text-xs text-[#6f626b]">{listedDate(message.createdAt)}</time></div><p className="mt-2 line-clamp-2 break-words text-sm text-[#6f626b]">{message.body}</p></article>)}</div></section>}
  </AppShell>;
}
