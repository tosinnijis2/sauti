import "server-only";
import { prisma } from "../prisma";

export const EXPECTED_EVALUATION_INTERVAL_MS = 60 * 60_000;

export async function priceWatchRunHealth(now = new Date(), page = 1, pageSize = 20) {
  const [runs, totalRuns, cleanupBacklog, cleanupFailures] = await Promise.all([
    prisma.priceWatchEvaluationRun.findMany({ orderBy: [{ startedAt: "desc" }, { id: "desc" }], skip: (page - 1) * pageSize, take: pageSize }),
    prisma.priceWatchEvaluationRun.count(),
    prisma.cloudAssetCleanupJob.count({ where: { status: "PENDING" } }),
    prisma.cloudAssetCleanupJob.count({ where: { status: "FAILED" } }),
  ]);
  const latest = runs[0] ?? null;
  const lastSuccessful = await prisma.priceWatchEvaluationRun.findFirst({ where: { status: "SUCCEEDED" }, orderBy: [{ completedAt: "desc" }, { id: "desc" }] });
  const stale = !lastSuccessful?.completedAt || now.getTime() - lastSuccessful.completedAt.getTime() > EXPECTED_EVALUATION_INTERVAL_MS;
  const repeatedFailures = runs.slice(0, 3).filter(run => run.status === "FAILED").length >= 2;
  const warning = latest?.status === "FAILED" || stale || repeatedFailures;
  return { status: warning || cleanupFailures ? "Needs attention" as const : "Healthy" as const, latest, lastSuccessful, stale, repeatedFailures, runs, totalRuns, pages: Math.max(1, Math.ceil(totalRuns / pageSize)), cleanupBacklog, cleanupFailures };
}
