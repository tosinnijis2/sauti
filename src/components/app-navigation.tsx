"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Heart,
  Bell,
  ChartNoAxesCombined,
  MessageCircle,
  PackagePlus,
  Store,
  Tags,
  UserRound,
  Handshake,
  ListFilter,
  type LucideIcon,
} from "lucide-react";

type NavItem = {
  href: string;
  label: string;
  mobileLabel: string;
  icon: LucideIcon;
  matches: (pathname: string) => boolean;
  primary?: boolean;
};

const navItems: NavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    mobileLabel: "Home",
    icon: LayoutDashboard,
    matches: (pathname) => pathname === "/dashboard",
  },
  {
    href: "/market",
    label: "Market",
    mobileLabel: "Market",
    icon: Tags,
    matches: (pathname) => pathname.startsWith("/market"),
  },
  {
    href: "/listings/new",
    label: "Add product",
    mobileLabel: "Sell",
    icon: PackagePlus,
    matches: (pathname) => pathname === "/listings/new",
    primary: true,
  },
  {
    href: "/listings",
    label: "My listings",
    mobileLabel: "Listings",
    icon: Store,
    matches: (pathname) =>
      pathname === "/listings" ||
      (pathname.startsWith("/listings/") && pathname !== "/listings/new"),
  },
  {
    href: "/messages",
    label: "Messages",
    mobileLabel: "Messages",
    icon: MessageCircle,
    matches: (pathname) => pathname.startsWith("/messages"),
  },
  { href: "/deals", label: "Deals", mobileLabel: "Deals", icon: Handshake, matches: pathname => pathname === "/deals" },
  { href: "/saved", label: "Saved Listings", mobileLabel: "Saved", icon: Heart, matches: pathname => pathname === "/saved" },
  { href: "/price-watches", label: "Price Watches", mobileLabel: "Watches", icon: ChartNoAxesCombined, matches: pathname => pathname === "/price-watches" },
  { href: "/saved-searches", label: "Saved Searches", mobileLabel: "Searches", icon: ListFilter, matches: pathname => pathname === "/saved-searches" },
  { href: "/notifications", label: "Notifications", mobileLabel: "Alerts", icon: Bell, matches: pathname => pathname === "/notifications" },
  {
    href: "/profile",
    label: "Profile",
    mobileLabel: "Profile",
    icon: UserRound,
    matches: (pathname) => pathname.startsWith("/profile"),
  },
];

export function DesktopNavigation({ unreadCount = 0, unreadMessages = 0 }: { unreadCount?: number; unreadMessages?: number }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Account navigation" className="mt-8 grid gap-1">
      {navItems.map(({ href, label, icon: Icon, matches }) => {
        const active = matches(pathname);

        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`relative flex min-h-12 items-center gap-3 rounded-lg px-4 text-sm font-semibold transition-colors ${
              active
                ? "bg-white/10 text-white"
                : "text-white/65 hover:bg-white/5 hover:text-white"
            }`}
          >
            {active && (
              <span aria-hidden="true" className="absolute left-0 h-6 w-1 rounded-r-full bg-[#fe7a7c]" />
            )}
            <Icon size={20} strokeWidth={active ? 2.5 : 2} className={active ? "text-[#fe7a7c]" : undefined} />
            <span className="min-w-0 flex-1 truncate">{label}</span>{href === "/notifications" && unreadCount > 0 && <span className="rounded-full bg-[#fe7a7c] px-2 py-0.5 text-xs font-bold text-[#20141d]">{Math.min(unreadCount, 99)}</span>}{href === "/messages" && unreadMessages > 0 && <span className="rounded-full bg-[#fe7a7c] px-2 py-0.5 text-xs font-bold text-[#20141d]">{Math.min(unreadMessages, 99)}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

export function MobileNavigation({ unreadCount = 0, unreadMessages = 0 }: { unreadCount?: number; unreadMessages?: number }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary navigation"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-[#20141d]/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-10px_30px_rgba(32,20,29,0.18)] backdrop-blur-xl md:hidden"
    >
      <div className="mx-auto grid h-20 max-w-lg grid-cols-5 px-1">
        {navItems.filter(item => ["/market", "/listings/new", "/messages", "/notifications", "/profile"].includes(item.href)).map(({ href, mobileLabel, icon: Icon, matches, primary }) => {
          const active = matches(pathname);

          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`relative flex min-w-0 flex-col items-center justify-center gap-1 text-[11px] font-semibold transition-colors ${
                active ? "text-[#fe7a7c]" : "text-white/55 hover:text-white"
              }`}
            >
              {active && (
                <span aria-hidden="true" className="absolute top-0 h-1 w-7 rounded-b-full bg-[#fe7a7c]" />
              )}
              <span
                className={`grid size-9 place-items-center rounded-full transition-colors ${
                  primary
                    ? active
                      ? "bg-white text-[#20141d]"
                      : "bg-[#fe7a7c] text-[#20141d]"
                    : ""
                }`}
              >
                <Icon size={22} strokeWidth={active ? 2.5 : 2} />
                {href === "/notifications" && unreadCount > 0 && <span className="absolute right-3 top-3 grid min-w-5 place-items-center rounded-full bg-[#fe7a7c] px-1 text-[10px] font-bold text-[#20141d]">{Math.min(unreadCount, 99)}</span>}
                {href === "/messages" && unreadMessages > 0 && <span className="absolute right-3 top-3 grid min-w-5 place-items-center rounded-full bg-[#fe7a7c] px-1 text-[10px] font-bold text-[#20141d]">{Math.min(unreadMessages, 99)}</span>}
              </span>
              <span className={`max-w-full truncate ${active ? "font-extrabold" : ""}`}>
                {mobileLabel}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
