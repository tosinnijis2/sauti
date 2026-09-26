import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
      <Link href="/" className="text-3xl font-black tracking-tight text-[#fe7a7c]">
        Sauti.
      </Link>
      <nav className="flex items-center gap-6 text-sm font-semibold text-white">
        <a href="#features" className="hidden sm:inline">Features</a>
        <Link href="/market" className="hidden sm:inline">Marketplace</Link>
        <Link href="/login">Sign in</Link>
        <Link href="/register" className="rounded-full bg-[#fe7a7c] px-4 py-2 text-[#20141d]">
          Join Sauti
        </Link>
      </nav>
    </header>
  );
}
