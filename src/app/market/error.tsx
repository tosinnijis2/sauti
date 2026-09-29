"use client";
export default function MarketError({ reset }: { reset: () => void }) {
  return <main className="mx-auto max-w-xl px-5 py-16"><h1 className="text-2xl font-bold">The market is temporarily unavailable</h1><p role="alert" className="mt-3 text-[#6f626b]">We could not load these listings. Please try again.</p><button onClick={reset} className="mt-6 rounded-lg bg-[#20141d] px-5 py-3 text-white">Try again</button></main>;
}
