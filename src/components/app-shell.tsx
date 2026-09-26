import Link from "next/link";
import { LayoutDashboard, PackagePlus, Store, Tags, UserRound } from "lucide-react";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/market", label: "Market prices", icon: Tags },
  { href: "/listings", label: "My listings", icon: Store },
  { href: "/listings/new", label: "Add product", icon: PackagePlus },
  { href: "/profile", label: "Profile", icon: UserRound },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#fffaf8] md:grid md:grid-cols-[250px_1fr]">
      <aside className="bg-[#20141d] p-6 text-white">
        <Link href="/" className="text-3xl font-black text-[#fe7a7c]">Sauti.</Link>
        <nav className="mt-10 grid gap-2">
          {nav.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-white/80 hover:bg-white/10 hover:text-white">
              <Icon size={18} />
              {label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="p-6 md:p-10">{children}</main>
    </div>
  );
}
