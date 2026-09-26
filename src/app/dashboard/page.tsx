import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { PackagePlus, Store, Tags, UserRound } from "lucide-react";

const cards = [
  { href: "/listings/new", title: "Add product", text: "Create a new marketplace listing.", icon: PackagePlus },
  { href: "/market", title: "Market prices", text: "Compare products across locations.", icon: Tags },
  { href: "/listings", title: "My listings", text: "Review and manage your products.", icon: Store },
  { href: "/profile", title: "Profile", text: "Update your seller information.", icon: UserRound },
];

export default function DashboardPage() {
  return <AppShell><p className="text-sm font-bold uppercase tracking-[.2em] text-[#fe7a7c]">Dashboard</p><h1 className="mt-2 text-4xl font-black">Welcome back</h1><p className="mt-2 text-[#6f626b]">This replaces the original Redux-driven dashboard with a clean App Router layout.</p><div className="mt-10 grid gap-5 sm:grid-cols-2">{cards.map(({ href, title, text, icon: Icon }) => <Link key={href} href={href} className="rounded-3xl bg-[#20141d] p-7 text-white transition hover:-translate-y-1"><Icon className="text-[#fe7a7c]" /><h2 className="mt-8 text-2xl font-bold text-[#fe7a7c]">{title}</h2><p className="mt-2 text-white/65">{text}</p></Link>)}</div></AppShell>;
}
