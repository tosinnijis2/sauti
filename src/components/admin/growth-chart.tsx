type Bucket = { date: string; users: number; listings: number };
export function GrowthChart({ buckets }: { buckets: Bucket[] }) {
  const max = Math.max(1, ...buckets.flatMap(bucket => [bucket.users, bucket.listings]));
  const hasData = buckets.some(bucket => bucket.users || bucket.listings);
  return <section className="min-w-0 border-y border-[#eadfdf] py-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-bold">Marketplace growth</h2><div className="flex gap-4 text-xs"><span className="flex items-center gap-2"><span className="size-2 bg-[#dc666c]" />New users</span><span className="flex items-center gap-2"><span className="size-2 bg-[#16877d]" />New listings</span></div></div>
    {!hasData ? <p className="flex h-52 items-center justify-center text-sm text-[#6f626b]">No registrations or listings in this period.</p> : <div className="mt-6 flex h-52 items-end gap-2 border-b border-[#eadfdf]" aria-label="New users and listings by period">
      {buckets.map(bucket => <div key={bucket.date} className="group relative flex h-full min-w-0 flex-1 items-end justify-center gap-1 pb-7" tabIndex={0} aria-label={`${bucket.date}: ${bucket.users} users, ${bucket.listings} listings`}>
        <div className="w-3 max-w-[40%] bg-[#dc666c]" style={{ height: `${bucket.users / max * 85}%` }} /><div className="w-3 max-w-[40%] bg-[#16877d]" style={{ height: `${bucket.listings / max * 85}%` }} />
        <span className="absolute bottom-1 text-[10px] text-[#6f626b]">{bucket.date.slice(5).replace("-", "/")}</span>
        <span role="tooltip" className="pointer-events-none absolute bottom-10 left-1/2 z-10 hidden w-32 -translate-x-1/2 rounded bg-[#20141d] p-2 text-xs text-white group-hover:block group-focus:block">{bucket.date}<br />{bucket.users} users<br />{bucket.listings} listings</span>
      </div>)}
    </div>}
    <details className="mt-4 text-sm"><summary className="cursor-pointer text-[#6f626b]">View growth data</summary><div className="mt-3 overflow-x-auto"><table className="w-full text-left"><thead><tr><th className="py-2">Period starting (UTC)</th><th>Users</th><th>Listings</th></tr></thead><tbody>{buckets.map(bucket => <tr key={bucket.date} className="border-t border-[#eadfdf]"><td className="py-2">{bucket.date}</td><td>{bucket.users}</td><td>{bucket.listings}</td></tr>)}</tbody></table></div></details>
  </section>;
}
