import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";

export async function SiteHeader() {
  const user = await getCurrentUser();

  return (
    <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5 sm:px-6 sm:py-7">
      <Link href="/" className="text-3xl font-black tracking-tight text-[#fe7a7c] sm:text-4xl">
        Sauti.
      </Link>
      <nav className="flex items-center gap-4 text-base font-semibold text-white sm:gap-8">
        <Link href="/#features" className="hidden transition-colors hover:text-[#fe7a7c] sm:inline">Features</Link>
        <Link href="/market" className="hidden transition-colors hover:text-[#fe7a7c] sm:inline">Marketplace</Link>
        {user ? (
          <Link href="/dashboard" className="inline-flex min-h-11 items-center rounded-full bg-[#fe7a7c] px-5 font-bold text-[#20141d] transition-colors hover:bg-[#ff9698]">
            Dashboard
          </Link>
        ) : (
          <Link href="/login" className="inline-flex min-h-11 items-center whitespace-nowrap rounded-full border border-white/25 px-5 font-bold transition-colors hover:border-[#fe7a7c] hover:bg-[#fe7a7c] hover:text-[#20141d]">
            Sign in
          </Link>
        )}
      </nav>
    </header>
  );
}
