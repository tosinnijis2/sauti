import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { COMPARISON_UNITS } from "../units";
import { capturePriceSnapshot, priceSnapshotState, type SnapshotProduct } from "../price-snapshots";

type LatestSnapshot = { id: string; productKey: string; stateHash: string };
type DuplicateSnapshot = { id: string; productKey: string };
type OrphanReference = { id: string; productId: string };
export type HistoryAuditIssue = { type: "missing-current" | "state-mismatch" | "impossible-price" | "invalid-unit" | "duplicate-state" | "invalid-reference"; recordId: string; productKey?: string };

async function eligibleProducts() {
  const candidates = await prisma.product.findMany({ where: { status: "ACTIVE", commodity: { not: null }, quantity: { not: null }, unit: { not: null } }, orderBy: { id: "asc" } });
  return candidates.filter(product => priceSnapshotState(product));
}

export async function auditHistoricalData() {
  const products = await eligibleProducts();
  const keys = products.map(product => product.id);
  const latest = keys.length ? await prisma.$queryRaw<LatestSnapshot[]>(Prisma.sql`
    SELECT DISTINCT ON ("productKey") id, "productKey", "stateHash"
    FROM "PriceSnapshot" WHERE "productKey" IN (${Prisma.join(keys)})
    ORDER BY "productKey", "capturedAt" DESC, id DESC`) : [];
  const latestByKey = new Map(latest.map(snapshot => [snapshot.productKey, snapshot]));
  const issues: HistoryAuditIssue[] = [];
  let withSnapshot = 0;
  let current = 0;
  for (const product of products) {
    const snapshot = latestByKey.get(product.id);
    const expected = priceSnapshotState(product)!;
    if (!snapshot) issues.push({ type: "missing-current", recordId: product.id, productKey: product.id });
    else {
      withSnapshot++;
      if (snapshot.stateHash === expected.stateHash) current++;
      else issues.push({ type: "state-mismatch", recordId: snapshot.id, productKey: product.id });
    }
  }

  const [impossible, invalidUnits, duplicates, invalidReferences] = await Promise.all([
    prisma.$queryRaw<{ id: string; productKey: string }[]>`SELECT id, "productKey" FROM "PriceSnapshot" WHERE "normalizedPrice"::text = 'NaN' OR "normalizedPrice" <= 0 LIMIT 100`,
    prisma.priceSnapshot.findMany({ where: { normalizedUnit: { notIn: [...COMPARISON_UNITS] } }, select: { id: true, productKey: true }, take: 100 }),
    prisma.$queryRaw<DuplicateSnapshot[]>`
      WITH ordered AS (
        SELECT id, "productKey", "stateHash", "captureReason",
          LAG("stateHash") OVER (PARTITION BY "productKey" ORDER BY "capturedAt", id) AS previous_hash
        FROM "PriceSnapshot"
      )
      SELECT id, "productKey" FROM ordered
      WHERE "stateHash" = previous_hash AND "captureReason" <> 'REACTIVATED'::"PriceSnapshotReason"
      LIMIT 100`,
    prisma.$queryRaw<OrphanReference[]>`
      SELECT s.id, s."productId" FROM "PriceSnapshot" s
      LEFT JOIN "Product" p ON p.id = s."productId"
      WHERE s."productId" IS NOT NULL AND p.id IS NULL LIMIT 100`,
  ]);
  issues.push(...impossible.map(row => ({ type: "impossible-price" as const, recordId: row.id, productKey: row.productKey })));
  issues.push(...invalidUnits.map(row => ({ type: "invalid-unit" as const, recordId: row.id, productKey: row.productKey })));
  issues.push(...duplicates.map(row => ({ type: "duplicate-state" as const, recordId: row.id, productKey: row.productKey })));
  issues.push(...invalidReferences.map(row => ({ type: "invalid-reference" as const, recordId: row.id, productKey: row.productId })));
  return {
    eligible: products.length,
    withSnapshot,
    current,
    missingCurrent: products.length - current,
    issueCount: issues.length,
    issues,
  };
}

export async function computeHistoricalDataHealth(now = new Date()) {
  const since = (days: number) => new Date(now.getTime() - days * 86_400_000);
  const [total, last24h, last7d, last30d, latest, commodities, countries, audit] = await Promise.all([
    prisma.priceSnapshot.count(),
    prisma.priceSnapshot.count({ where: { capturedAt: { gte: since(1), lte: now } } }),
    prisma.priceSnapshot.count({ where: { capturedAt: { gte: since(7), lte: now } } }),
    prisma.priceSnapshot.count({ where: { capturedAt: { gte: since(30), lte: now } } }),
    prisma.priceSnapshot.aggregate({ _max: { capturedAt: true } }),
    prisma.priceSnapshot.groupBy({ by: ["commodity"], _count: { id: true }, orderBy: { commodity: "asc" } }),
    prisma.priceSnapshot.groupBy({ by: ["country"], _count: { id: true }, orderBy: { country: "asc" } }),
    auditHistoricalData(),
  ]);
  const needsAttention = audit.missingCurrent > 0 || audit.issues.some(issue => !["missing-current", "state-mismatch"].includes(issue.type));
  return {
    status: needsAttention ? "Needs attention" as const : "Healthy" as const,
    total, last24h, last7d, last30d,
    eligibleActive: audit.eligible,
    eligibleWithSnapshot: audit.withSnapshot,
    missingExpected: audit.missingCurrent,
    latestSnapshotAt: latest._max.capturedAt,
    commodities: commodities.map(row => ({ commodity: row.commodity, count: row._count.id })),
    countries: countries.map(row => ({ country: row.country, count: row._count.id })),
    audit,
  };
}

export type HistoryRepairSummary = { scanned: number; eligible: number; alreadyCurrent: number; missingSnapshot: number; staleSnapshot: number; created: number; skipped: number; errors: number; dryRun: boolean };

export async function repairCurrentPriceSnapshots({ dryRun = false }: { dryRun?: boolean } = {}): Promise<HistoryRepairSummary> {
  const candidates = await prisma.product.findMany({ where: { status: "ACTIVE" }, orderBy: { id: "asc" } });
  const summary: HistoryRepairSummary = { scanned: candidates.length, eligible: 0, alreadyCurrent: 0, missingSnapshot: 0, staleSnapshot: 0, created: 0, skipped: 0, errors: 0, dryRun };
  for (const candidate of candidates) {
    const state = priceSnapshotState(candidate as SnapshotProduct);
    if (!state) { summary.skipped++; continue; }
    summary.eligible++;
    const latest = await prisma.priceSnapshot.findFirst({ where: { productKey: candidate.id }, orderBy: [{ capturedAt: "desc" }, { id: "desc" }], select: { stateHash: true } });
    if (latest?.stateHash === state.stateHash) { summary.alreadyCurrent++; continue; }
    if (latest) summary.staleSnapshot++; else summary.missingSnapshot++;
    if (dryRun) continue;
    try {
      const created = await prisma.$transaction(async tx => {
        await tx.$queryRaw`SELECT id FROM "Product" WHERE id = ${candidate.id} FOR UPDATE`;
        const product = await tx.product.findUnique({ where: { id: candidate.id } });
        return product ? capturePriceSnapshot(tx, product, { reason: "REPAIR", operation: "history-repair" }) : false;
      });
      if (created) summary.created++;
      else summary.alreadyCurrent++;
    } catch {
      summary.errors++;
    }
  }
  return summary;
}
