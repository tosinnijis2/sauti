export default function InsightsLoading() {
  return <main aria-label="Loading market insights" aria-busy="true" className="mx-auto max-w-7xl animate-pulse px-6 py-10"><div className="h-9 w-64 rounded bg-[#eadfdf]" /><div className="mt-7 h-28 bg-[#ecf2ef]" /><div className="mt-8 grid grid-cols-2 gap-6 sm:grid-cols-4">{[0, 1, 2, 3].map(item => <div key={item} className="h-24 bg-[#eadfdf]" />)}</div><div className="mt-10 h-64 bg-[#ecf2ef]" /></main>;
}
