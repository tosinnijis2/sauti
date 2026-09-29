"use client";

export default function DashboardError({ reset }: { reset: () => void }) {
  return <main className="p-6 md:p-10"><h1 className="text-2xl font-bold">Your dashboard couldn&apos;t load.</h1><button onClick={reset} className="mt-5 min-h-11 rounded-lg bg-[#20141d] px-5 text-sm font-semibold text-white">Try again</button></main>;
}
