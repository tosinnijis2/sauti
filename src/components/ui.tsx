import Link from "next/link";
import type { ReactNode } from "react";

export const fieldClass = "min-h-11 w-full rounded-lg border border-[#d9cccc] bg-white px-3 py-2 text-[#20141d] outline-none transition-colors placeholder:text-[#8b7d85] focus:border-[#fe7a7c] disabled:cursor-not-allowed disabled:bg-[#f3eeee] disabled:text-[#6f626b]";
export const primaryButtonClass = "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#20141d] px-5 py-2.5 text-sm font-bold text-white transition-[background-color,transform] hover:bg-[#342330] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60";
export const secondaryButtonClass = "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[#d9cccc] bg-white px-4 py-2.5 text-sm font-bold text-[#20141d] transition-colors hover:bg-[#fff4f1] active:bg-[#ffe9e5] disabled:cursor-not-allowed disabled:opacity-60";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-lg border border-[#eadfdf] bg-white p-5 ${className}`}>{children}</section>;
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "success" | "warning" | "accent" }) {
  const tones = { neutral: "border-[#d9cccc] bg-white text-[#5f535b]", success: "border-green-200 bg-green-50 text-green-800", warning: "border-amber-200 bg-amber-50 text-amber-900", accent: "border-[#ffc6c4] bg-[#ffe0df] text-[#7b2f43]" };
  return <span className={`inline-flex min-h-7 items-center rounded-full border px-2.5 text-xs font-bold ${tones[tone]}`}>{children}</span>;
}

export function Alert({ children, tone = "error" }: { children: ReactNode; tone?: "error" | "success" | "info" }) {
  const tones = { error: "border-red-200 bg-red-50 text-red-800", success: "border-green-200 bg-green-50 text-green-800", info: "border-[#cbded6] bg-[#edf4f1] text-[#31564a]" };
  return <div role={tone === "error" ? "alert" : "status"} className={`rounded-lg border p-3 text-sm ${tones[tone]}`}>{children}</div>;
}

export function EmptyState({ icon, title, description, href, action }: { icon?: ReactNode; title: string; description: string; href?: string; action?: string }) {
  return <section className="rounded-lg border border-dashed border-[#d9cccc] bg-white/55 px-5 py-12 text-center"><div className="mx-auto grid size-11 place-items-center text-[#9d334b]">{icon}</div><h2 className="mt-3 text-xl font-bold">{title}</h2><p className="mx-auto mt-2 max-w-md text-sm text-[#6f626b]">{description}</p>{href && action && <Link href={href} className={`${primaryButtonClass} mt-5`}>{action}</Link>}</section>;
}

export function Skeleton({ className = "h-5 w-full" }: { className?: string }) {
  return <span aria-hidden="true" className={`block animate-pulse rounded-md bg-[#eadfdf] motion-reduce:animate-none ${className}`} />;
}
