"use client";
export default function AdminError({ reset }: { reset: () => void }) {
  return <section role="alert" className="py-12"><h1 className="text-2xl font-bold">Admin data is unavailable</h1><p className="mt-3 text-[#6f626b]">The request could not be completed. Please try again.</p><button onClick={reset} className="mt-6 rounded-lg bg-[#20141d] px-5 py-3 text-white">Try again</button></section>;
}
