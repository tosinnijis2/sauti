"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState, type ReactNode } from "react";
import { Activity, Bell, ChartNoAxesCombined, Handshake, LayoutDashboard, LogOut, Menu, PanelLeftClose, PanelLeftOpen, Plus, Search, Star, Store, UserRound, X, MessageSquare, History } from "lucide-react";
import { logoutAction } from "@/app/actions/auth";

const links = [
  { href: "/admin/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/search", label: "Search records", icon: Search },
  { href: "/admin/messages", label: "Message moderation", icon: MessageSquare },
  { href: "/admin/audit-logs", label: "Audit logs", icon: History },
  { href: "/admin/history", label: "Snapshot health", icon: Activity },
  { href: "/admin/evaluations", label: "Evaluator runs", icon: ChartNoAxesCombined },
  { href: "/admin/deals", label: "Disputed deals", icon: Handshake },
  { href: "/admin/reviews", label: "Review moderation", icon: Star },
  { href: "/admin/reports", label: "Safety reports", icon: Bell },
  { href: "/market", label: "Marketplace", icon: Store },
];

export function AdminShell({ name, pendingReports, children }: { name: string; pendingReports: number; children: ReactNode }) {
  const path = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const drawer = useRef<HTMLDialogElement>(null);
  function navigation(compact: boolean) {
    return <nav aria-label="Admin navigation" className="mt-8 space-y-2">{links.map(({ href, label, icon: Icon }) => <Link key={href} href={href} title={compact ? label : undefined} aria-label={compact ? label : undefined} aria-current={path === href ? "page" : undefined} onClick={() => drawer.current?.close()} className={`flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm ${path === href ? "bg-white/10 font-bold text-[#fe7a7c]" : "text-white/75 hover:bg-white/5"}`}><Icon size={20} className="shrink-0" />{!compact && label}</Link>)}</nav>;
  }
  function account(compact: boolean) {
    return <div className="mt-auto border-t border-white/15 pt-4"><Link href="/profile" title="My profile" aria-label="My profile" className="flex min-h-11 items-center gap-3 px-3"><UserRound size={20} className="shrink-0" />{!compact && <span className="truncate text-sm">{name}</span>}</Link><form action={logoutAction}><button title="Sign out" aria-label="Sign out" className="flex min-h-11 w-full items-center gap-3 px-3 text-white/75"><LogOut size={20} />{!compact && <span className="text-sm">Sign out</span>}</button></form></div>;
  }
  return <div className="min-h-screen bg-[#fafafa] text-[#20141d] lg:flex">
    <a href="#admin-content" className="sr-only focus:not-sr-only focus:fixed focus:z-50 focus:bg-white focus:p-4">Skip to content</a>
    <aside className={`sticky top-0 hidden h-screen shrink-0 flex-col bg-[#20141d] px-4 py-6 text-white lg:flex ${collapsed ? "w-20" : "w-60"}`}>
      <Link href="/admin/dashboard" aria-label="Sauti admin" className="px-2 text-2xl font-black text-[#fe7a7c]">{collapsed ? "S." : "Sauti."}</Link>
      <button title={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} onClick={() => setCollapsed(!collapsed)} className="mt-5 flex size-11 items-center justify-center rounded-lg border border-white/20">{collapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}</button>
      {navigation(collapsed)}{account(collapsed)}
    </aside>
    <dialog ref={drawer} aria-label="Admin navigation drawer" className="fixed inset-y-0 left-0 m-0 h-dvh max-h-none w-72 max-w-[90vw] bg-[#20141d] p-5 text-white backdrop:bg-black/50" onClick={event => { if (event.target === drawer.current) drawer.current.close(); }}>
      <div className="flex h-full flex-col"><div className="flex items-center justify-between"><Link href="/admin/dashboard" className="text-2xl font-black text-[#fe7a7c]">Sauti.</Link><button aria-label="Close navigation" title="Close navigation" onClick={() => drawer.current?.close()} className="grid size-11 place-items-center"><X size={22} /></button></div>{navigation(false)}{account(false)}</div>
    </dialog>
    <div className="min-w-0 flex-1">
      <header className="flex flex-wrap items-center gap-3 border-b border-[#eadfdf] bg-white px-5 py-3 lg:px-8">
        <button title="Open navigation" aria-label="Open navigation" onClick={() => drawer.current?.showModal()} className="grid size-11 place-items-center rounded-lg border border-[#eadfdf] lg:hidden"><Menu size={20} /></button>
        <nav aria-label="Breadcrumb" className="mr-auto text-sm text-[#6f626b]"><Link href="/admin/dashboard">Admin</Link><span aria-hidden="true" className="mx-2">/</span><span className="font-semibold text-[#20141d]">{path === "/admin/delete" ? "Confirm deletion" : links.find(link => link.href === path)?.label ?? "Administration"}</span></nav>
        <form action="/admin/search" className="order-last flex w-full items-center rounded-lg border border-[#eadfdf] sm:order-none sm:w-64"><input aria-label="Search users and listings" name="q" maxLength={100} placeholder="Search users, listings..." className="min-w-0 flex-1 bg-transparent p-2.5 text-sm" /><button title="Search" aria-label="Search" className="grid size-10 shrink-0 place-items-center"><Search size={18} /></button></form>
        <Link href="/admin/search?type=reports" title="Pending reports" aria-label={`${pendingReports} pending reports`} className="relative grid size-11 place-items-center rounded-lg border border-[#eadfdf]"><Bell size={19} />{pendingReports > 0 && <span className="absolute -right-1 -top-1 rounded-full bg-[#fe7a7c] px-1.5 text-xs font-bold">{pendingReports > 99 ? "99+" : pendingReports}</span>}</Link>
        <Link href="/listings/new" title="Add listing" aria-label="Add listing" className="grid size-11 place-items-center rounded-lg bg-[#20141d] text-white"><Plus size={20} /></Link>
        <Link href="/profile" title={name + " - profile"} aria-label="My profile" className="grid size-10 shrink-0 place-items-center rounded-full bg-[#ffe0df] font-bold">{name.slice(0, 1).toUpperCase()}</Link>
      </header>
      <main id="admin-content" className="mx-auto max-w-[1600px] p-5 lg:p-8">{children}</main>
    </div>
  </div>;
}
