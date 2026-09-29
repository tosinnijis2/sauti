export default function SavedLoading() {
  return <main role="status" aria-label="Loading saved listings" className="p-6 md:p-10"><div className="mb-8 h-9 w-52 rounded bg-[#e6e4e4] motion-safe:animate-pulse" /><div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map(key => <div key={key} className="aspect-[4/5] rounded-lg bg-[#edf1ef] motion-safe:animate-pulse" />)}</div></main>;
}
