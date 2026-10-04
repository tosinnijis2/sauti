import Link from "next/link";
import { LogOut } from "lucide-react";
import { logoutAction } from "@/app/actions/auth";
import { DesktopNavigation, MobileNavigation } from "@/components/app-navigation";
import { requireUser } from "@/lib/auth";
import { unreadNotificationCount } from "@/lib/notifications";
import { Avatar } from "@/components/avatar";
import { unreadConversationCount } from "@/lib/chat";

export async function AppShell({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [unreadCount, unreadMessages] = await Promise.all([unreadNotificationCount(user.id), unreadConversationCount(user.id)]);

  return (
    <div className="min-h-screen bg-[#fffaf8] md:grid md:grid-cols-[250px_1fr]">
      <aside className="sticky top-0 hidden h-screen flex-col overflow-y-auto bg-[#20141d] p-6 text-white md:flex">
        <div>
          <Link href="/" className="text-3xl font-black text-[#fe7a7c]">Sauti.</Link>
          <Link href="/profile" className="mt-6 flex items-center gap-3 rounded-lg border border-white/10 p-3"><Avatar name={user.name} imageUrl={user.imageUrl} /><span className="min-w-0"><span className="block truncate text-sm font-semibold">{user.name}</span><span className="text-xs text-white/50">View profile</span></span></Link>
          <DesktopNavigation unreadCount={unreadCount} unreadMessages={unreadMessages} />
          {user.role === "ADMIN" && <Link href="/admin/dashboard" className="mt-4 block rounded-lg border border-white/20 px-4 py-3 text-sm font-bold text-[#fe7a7c]">Administration</Link>}
        </div>
        <form action={logoutAction} className="mt-auto pt-8">
          <button type="submit" className="flex min-h-12 w-full items-center gap-3 rounded-lg px-4 text-sm font-semibold text-white/60 transition-colors hover:bg-white/5 hover:text-white">
            <LogOut size={18} />
            Log out
          </button>
        </form>
      </aside>

      <div className="md:hidden">
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-white/10 bg-[#20141d]/95 px-4 text-white backdrop-blur-xl">
          <Link href="/dashboard" className="text-2xl font-black text-[#fe7a7c]">Sauti.</Link>
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/profile" aria-label="Open profile"><Avatar name={user.name} imageUrl={user.imageUrl} size="sm" /></Link>
            <form action={logoutAction}>
              <button
                type="submit"
                aria-label="Log out"
                title="Log out"
                className="grid size-11 place-items-center rounded-full text-white/65 transition-colors hover:bg-white/10 hover:text-white"
              >
                <LogOut size={19} />
              </button>
            </form>
          </div>
        </header>
      </div>

      <main className="min-w-0 p-5 pb-28 md:p-10">{user.role === "ADMIN" && <div className="mb-5 md:hidden"><Link href="/admin/dashboard" className="text-sm font-bold underline">Administration</Link></div>}{children}</main>
      <MobileNavigation unreadCount={unreadCount} unreadMessages={unreadMessages} />
    </div>
  );
}
