import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { ExactDecimal } from "./decimal";
import type { InsightFilters } from "./insight-filters";

export const MIN_HISTORY_OBSERVATIONS = 5;

type HistoryRow = { period: Date; observations: number; median: Prisma.Decimal };
export type HistoryPoint = { period: string; observations: number; median: string };
export type PriceHistory = {
  range: InsightFilters["range"];
  granularity: "day" | "week" | null;
  points: HistoryPoint[];
  observationCount: number;
  trend: { current: string; previous: string; percentage: string } | null;
  unavailableReason: "select-commodity" | "search-filter" | null;
};

function snapshotPredicate(filters: InsightFilters, now: Date) {
  const clauses = [
    Prisma.sql`"commodity"::text = ${filters.commodity}`,
    Prisma.sql`"variety"::text IS NOT DISTINCT FROM ${filters.variety || null}`,
    Prisma.sql`"grade"::text IS NOT DISTINCT FROM ${filters.grade || null}`,
    Prisma.sql`"normalizedUnit"::text = ${filters.unit}`,
  ];
  if (filters.range !== "all") {
    const from = new Date(now.getTime() - Number(filters.range) * 86_400_000);
    clauses.push(Prisma.sql`"capturedAt" >= ${from} AND "capturedAt" <= ${now}`);
  }
  if (filters.category) clauses.push(Prisma.sql`"category" = ${filters.category}`);
  if (filters.country) clauses.push(Prisma.sql`"country" = ${filters.country}`);
  if (filters.location) clauses.push(Prisma.sql`"location" ILIKE ${`%${filters.location}%`}`);
  return Prisma.join(clauses, " AND ");
}

async function buckets(filters: InsightFilters, granularity: "day" | "week", now: Date) {
  const period = granularity === "day"
    ? Prisma.sql`date_trunc('day', "capturedAt" AT TIME ZONE 'UTC')`
    : Prisma.sql`date_trunc('week', "capturedAt" AT TIME ZONE 'UTC')`;
  return prisma.$queryRaw<HistoryRow[]>(Prisma.sql`
    WITH observations AS (
      SELECT ${period} AS period, "normalizedPrice", id
      FROM "PriceSnapshot" WHERE ${snapshotPredicate(filters, now)}
    ), ranked AS (
      SELECT *, ROW_NUMBER() OVER (PARTITION BY period ORDER BY "normalizedPrice", id) AS rn,
        COUNT(*) OVER (PARTITION BY period) AS n
      FROM observations
    )
    SELECT period, COUNT(*)::int AS observations,
      AVG("normalizedPrice") FILTER (WHERE rn BETWEEN (n + 1) / 2 AND (n + 2) / 2) AS median
    FROM ranked GROUP BY period HAVING COUNT(*) >= ${MIN_HISTORY_OBSERVATIONS}
    ORDER BY period ASC`);
}

function serialize(rows: HistoryRow[]): HistoryPoint[] {
  return rows.map(row => ({
    period: row.period.toISOString(),
    observations: row.observations,
    median: row.median.toString(),
  }));
}

export async function historicalPriceHistory(filters: InsightFilters, now = new Date()): Promise<PriceHistory> {
  if (!filters.commodity) return { range: filters.range, granularity: null, points: [], observationCount: 0, trend: null, unavailableReason: "select-commodity" };
  // Snapshot rows deliberately omit mutable listing copy, so free-text search cannot be replayed honestly.
  if (filters.q) return { range: filters.range, granularity: null, points: [], observationCount: 0, trend: null, unavailableReason: "search-filter" };
  const daily = await buckets(filters, "day", now);
  const granularity = daily.length >= 2 ? "day" : "week";
  const points = serialize(granularity === "day" ? daily : await buckets(filters, "week", now));
  const latest = points.at(-1);
  const previous = points.at(-2);
  const trend = latest && previous && new ExactDecimal(previous.median).gt(0) ? {
    current: latest.median,
    previous: previous.median,
    percentage: new ExactDecimal(latest.median).minus(previous.median).div(previous.median).mul(100).toDecimalPlaces(1).toFixed(1),
  } : null;
  return { range: filters.range, granularity, points, observationCount: points.reduce((sum, point) => sum + point.observations, 0), trend, unavailableReason: null };
}
