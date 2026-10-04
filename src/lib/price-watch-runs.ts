import "server-only";
import { randomUUID } from "node:crypto";
import { Prisma, type PriceWatchRunSource } from "@prisma/client";
import { prisma } from "./prisma";
import { evaluatePriceWatches, type WatchEvaluationSummary } from "./price-watch-evaluator";
import { evaluateSavedSearches } from "./saved-search-evaluator";
import { processCloudCleanupJobs, type CleanupSummary } from "./cloud-cleanup";
import { pruneExpiredRateLimits } from "./rate-limit";
import { operationalError } from "./operations-log";

const LEASE_ID = "price-watch-evaluator";
export type PriceWatchRunResult = { acquired: boolean; runId: string; status: "SUCCEEDED" | "PARTIAL" | "FAILED" | "SKIPPED"; summary: WatchEvaluationSummary | null; cleanup?: CleanupSummary };
type Evaluator = (now?: Date) => Promise<WatchEvaluationSummary>;

async function evaluateScheduledMarketplace(now = new Date()): Promise<WatchEvaluationSummary> {
  const [watches, searches] = await Promise.all([evaluatePriceWatches(now), evaluateSavedSearches(now)]);
  return { scanned: watches.scanned + searches.scanned, evaluated: watches.evaluated + searches.evaluated, insufficient: watches.insufficient + searches.insufficient, triggered: watches.triggered + searches.triggered, suppressed: watches.suppressed + searches.suppressed, errors: watches.errors + searches.errors };
}

export async function runPriceWatchEvaluation({ source, now = new Date(), leaseMs = 25 * 60_000, evaluate = evaluateScheduledMarketplace }: { source: PriceWatchRunSource; now?: Date; leaseMs?: number; evaluate?: Evaluator }): Promise<PriceWatchRunResult> {
  const token = randomUUID();
  const expiresAt = new Date(now.getTime() + leaseMs);
  const acquired = await prisma.$queryRaw<{ token: string }[]>(Prisma.sql`
    INSERT INTO "PriceWatchEvaluatorLease" (id, token, "acquiredAt", "expiresAt")
    VALUES (${LEASE_ID}, ${token}, ${now}, ${expiresAt})
    ON CONFLICT (id) DO UPDATE SET token = EXCLUDED.token, "acquiredAt" = EXCLUDED."acquiredAt", "expiresAt" = EXCLUDED."expiresAt"
    WHERE "PriceWatchEvaluatorLease"."expiresAt" <= ${now}
    RETURNING token`);
  if (!acquired.length) {
    const run = await prisma.priceWatchEvaluationRun.create({ data: { source, status: "SKIPPED", startedAt: now, completedAt: now, durationMs: 0 } });
    return { acquired: false, runId: run.id, status: "SKIPPED", summary: null };
  }

  const run = await prisma.priceWatchEvaluationRun.create({ data: { source, status: "RUNNING", startedAt: now } });
  const started = Date.now();
  try {
    const summary = await evaluate(now);
    const cleanup = await processCloudCleanupJobs(now);
    await pruneExpiredRateLimits(now);
    const status = summary.errors || cleanup.failed ? "PARTIAL" as const : "SUCCEEDED" as const;
    await prisma.priceWatchEvaluationRun.update({ where: { id: run.id }, data: {
      status, completedAt: new Date(), durationMs: Math.max(0, Date.now() - started), watchesScanned: summary.scanned,
      watchesEvaluated: summary.evaluated, notificationsCreated: summary.triggered,
      watchesSkipped: summary.insufficient + summary.suppressed, errors: summary.errors + cleanup.failed,
      cleanupProcessed: cleanup.processed, cleanupSucceeded: cleanup.succeeded, cleanupFailed: cleanup.failed,
    } });
    return { acquired: true, runId: run.id, status, summary, cleanup };
  } catch {
    await prisma.priceWatchEvaluationRun.update({ where: { id: run.id }, data: { status: "FAILED", completedAt: new Date(), durationMs: Math.max(0, Date.now() - started), errors: 1 } });
    operationalError("scheduled-run-failed", { runId: run.id, source });
    return { acquired: true, runId: run.id, status: "FAILED", summary: null };
  } finally {
    await prisma.priceWatchEvaluatorLease.deleteMany({ where: { id: LEASE_ID, token } });
  }
}
