import "server-only";
import { randomUUID } from "node:crypto";
import { Prisma, type PriceWatchRunSource } from "@prisma/client";
import { prisma } from "./prisma";
import { evaluatePriceWatches, type WatchEvaluationSummary } from "./price-watch-evaluator";

const LEASE_ID = "price-watch-evaluator";
export type PriceWatchRunResult = { acquired: boolean; runId: string; status: "SUCCEEDED" | "PARTIAL" | "FAILED" | "SKIPPED"; summary: WatchEvaluationSummary | null };
type Evaluator = (now?: Date) => Promise<WatchEvaluationSummary>;

export async function runPriceWatchEvaluation({ source, now = new Date(), leaseMs = 25 * 60_000, evaluate = evaluatePriceWatches }: { source: PriceWatchRunSource; now?: Date; leaseMs?: number; evaluate?: Evaluator }): Promise<PriceWatchRunResult> {
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
    const status = summary.errors ? "PARTIAL" as const : "SUCCEEDED" as const;
    await prisma.priceWatchEvaluationRun.update({ where: { id: run.id }, data: {
      status, completedAt: new Date(), durationMs: Math.max(0, Date.now() - started), watchesScanned: summary.scanned,
      watchesEvaluated: summary.evaluated, notificationsCreated: summary.triggered,
      watchesSkipped: summary.insufficient + summary.suppressed, errors: summary.errors,
    } });
    return { acquired: true, runId: run.id, status, summary };
  } catch {
    await prisma.priceWatchEvaluationRun.update({ where: { id: run.id }, data: { status: "FAILED", completedAt: new Date(), durationMs: Math.max(0, Date.now() - started), errors: 1 } });
    console.error("[price-watch-run]", JSON.stringify({ runId: run.id, source, timestamp: now.toISOString(), context: "evaluation run failed" }));
    return { acquired: true, runId: run.id, status: "FAILED", summary: null };
  } finally {
    await prisma.priceWatchEvaluatorLease.deleteMany({ where: { id: LEASE_ID, token } });
  }
}
