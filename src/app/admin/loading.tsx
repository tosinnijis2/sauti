export default function Loading() {
  return <div role="status" aria-label="Loading admin data" className="space-y-8"><div className="h-8 w-60 animate-pulse rounded bg-gray-200" /><div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{Array.from({ length: 8 }, (_, index) => <div key={index} className="h-28 animate-pulse rounded-lg bg-gray-200" />)}</div><div className="h-60 animate-pulse rounded-lg bg-gray-200" /><span className="sr-only">Loading admin data</span></div>;
}
