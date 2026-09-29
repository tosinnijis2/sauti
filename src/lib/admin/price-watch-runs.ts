import "server-only";
import { prisma } from "../prisma";

export const EXPECTED_EVALUATION_INTERVAL_MS = 60 * 60_000;

export async function priceWatchRunHealth(now = new Date()) {
  const runs = await prisma.priceWatchEvaluationRun.findMany({ orderBy: [{ startedAt: "desc" }, { id: "desc" }], take: 20 });
  const latest = runs[0] ?? null;
  const lastSuccessful = await prisma.priceWatchEvaluationRun.findFirst({ where: { status: "SUCCEEDED" }, orderBy: [{ completedAt: "desc" }, { id: "desc" }] });
  const stale = !lastSuccessful?.completedAt || now.getTime() - lastSuccessful.completedAt.getTime() > EXPECTED_EVALUATION_INTERVAL_MS;
  const repeatedFailures = runs.slice(0, 3).filter(run => run.status === "FAILED").length >= 2;
  const warning = latest?.status === "FAILED" || stale || repeatedFailures;
  return { status: warning ? "Needs attention" as const : "Healthy" as const, latest, lastSuccessful, stale, repeatedFailures, runs };
}
