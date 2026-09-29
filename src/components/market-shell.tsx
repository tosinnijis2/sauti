import type { ReactNode } from "react";
import { getCurrentUser } from "@/lib/auth";
import { AppShell } from "./app-shell";
import { SiteHeader } from "./site-header";

export async function MarketShell({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (user) return <AppShell>{children}</AppShell>;
  return <><div className="bg-[#20141d] text-white"><SiteHeader /></div><main className="mx-auto min-h-screen max-w-7xl px-5 py-8 md:px-8">{children}</main></>;
}
