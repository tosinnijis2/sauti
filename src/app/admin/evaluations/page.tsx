import Link from "next/link";
import { AlertTriangle, CheckCircle2, Clock3 } from "lucide-react";
import { requireAdmin } from "@/lib/admin/auth";
import { priceWatchRunHealth } from "@/lib/admin/price-watch-runs";
import { prisma } from "@/lib/prisma";

const PAGE_SIZE = 20;

export default async function EvaluationRunsPage({ searchParams }: { searchParams: Promise<{ page?: string; cleanupPage?: string }> }) {
  await requireAdmin();
  const params = await searchParams;
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const cleanupPage = Math.max(1, Number.parseInt(params.cleanupPage ?? "1", 10) || 1);
  const data = await priceWatchRunHealth(new Date(), page, PAGE_SIZE);
  const [cleanupJobs, cleanupTotal] = await Promise.all([
    prisma.cloudAssetCleanupJob.findMany({ orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (cleanupPage - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    prisma.cloudAssetCleanupJob.count(),
  ]);
  const latest = data.latest;
  const cleanupPages = Math.max(1, Math.ceil(cleanupTotal / PAGE_SIZE));
  return <><header className="flex flex-wrap items-start justify-between gap-5"><div><p className="text-xs font-bold uppercase text-[#996066]">Marketplace operations</p><h1 className="mt-2 text-3xl font-bold">Scheduled operations</h1><p className="mt-3 max-w-2xl text-sm text-[#6f626b]">Price watches, saved searches, email retries, durable cleanup, and scheduler health.</p></div><div className={`flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-bold ${data.status === "Healthy" ? "border-green-200 bg-green-50 text-green-800" : "border-amber-200 bg-amber-50 text-amber-900"}`}>{data.status === "Healthy" ? <CheckCircle2 size={19} /> : <AlertTriangle size={19} />}{data.status}</div></header>
    <section aria-label="Latest operation metrics" className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[["Latest status", latest?.status ?? "No runs"], ["Duration", latest?.durationMs == null ? "Unavailable" : `${latest.durationMs} ms`], ["Records evaluated", latest?.watchesEvaluated ?? 0], ["Notifications", latest?.notificationsCreated ?? 0], ["Skipped or locked", (latest?.watchesSkipped ?? 0) + (latest?.status === "SKIPPED" ? 1 : 0)], ["Cleanup processed", latest?.cleanupProcessed ?? 0], ["Cleanup backlog", data.cleanupBacklog], ["Cleanup failures", data.cleanupFailures]].map(([label, value]) => <div key={label} className="rounded-lg border border-[#eadfdf] bg-white p-5"><p className="text-sm text-[#6f626b]">{label}</p><p className="mt-3 break-words text-2xl font-bold tabular-nums">{value}</p></div>)}</section>
    <section className="mt-7 border-y border-[#eadfdf] py-5"><div className="flex items-center gap-2"><Clock3 size={19} /><h2 className="font-bold">Scheduler freshness</h2></div><p className="mt-2 text-sm">{data.lastSuccessful?.completedAt ? `Last successful run: ${data.lastSuccessful.completedAt.toISOString()}` : "No successful run recorded."}</p>{data.stale && <p className="mt-2 text-sm font-semibold text-amber-800">No successful run completed within the expected 60-minute interval.</p>}</section>
    <section className="mt-7"><h2 className="text-lg font-bold">Run history</h2><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[840px] text-left text-sm"><thead><tr className="border-y"><th className="p-3">Started</th><th>Status</th><th>Source</th><th>Evaluated</th><th>Created</th><th>Skipped</th><th>Cleanup</th><th>Errors</th><th>Duration</th></tr></thead><tbody>{data.runs.map(run => <tr key={run.id} className="border-b"><td className="p-3">{run.startedAt.toISOString()}</td><td>{run.status}</td><td>{run.source}</td><td>{run.watchesEvaluated}</td><td>{run.notificationsCreated}</td><td>{run.watchesSkipped}</td><td>{run.cleanupSucceeded}/{run.cleanupProcessed}</td><td>{run.errors}</td><td>{run.durationMs ?? "-"} ms</td></tr>)}</tbody></table></div><Pager page={page} pages={data.pages} keyName="page" other={cleanupPage} /></section>
    <section className="mt-9"><h2 className="text-lg font-bold">Cloud asset cleanup jobs</h2>{cleanupJobs.length ? <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead><tr className="border-y"><th className="p-3">Created</th><th>Kind</th><th>Status</th><th>Attempts</th><th>Next attempt</th><th>Last error</th></tr></thead><tbody>{cleanupJobs.map(job => <tr key={job.id} className="border-b"><td className="p-3">{job.createdAt.toISOString()}</td><td>{job.kind}</td><td>{job.status}</td><td>{job.attempts}/5</td><td>{job.nextAttemptAt.toISOString()}</td><td>{job.lastErrorCode ?? "-"}</td></tr>)}</tbody></table></div> : <p className="mt-4 text-sm text-[#6f626b]">No cleanup jobs recorded.</p>}<Pager page={cleanupPage} pages={cleanupPages} keyName="cleanupPage" other={page} /></section></>;
}

function Pager({ page, pages, keyName, other }: { page: number; pages: number; keyName: "page" | "cleanupPage"; other: number }) {
  if (pages <= 1) return null;
  const href = (value: number) => `?${keyName}=${value}&${keyName === "page" ? "cleanupPage" : "page"}=${other}`;
  return <nav aria-label={`${keyName} pagination`} className="mt-4 flex justify-between text-sm"><span>Page {page} of {pages}</span><span className="flex gap-4">{page > 1 && <Link href={href(page - 1)} className="underline">Previous</Link>}{page < pages && <Link href={href(page + 1)} className="underline">Next</Link>}</span></nav>;
}
