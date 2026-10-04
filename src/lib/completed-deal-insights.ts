import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { ExactDecimal } from "./decimal";
import type { InsightFilters } from "./insight-filters";
import { UNIT_RULES, UNIT_VALUES, type ComparisonUnit } from "./units";
import type { Commodity, Grade, Variety } from "./commodities";

export const MIN_COMPLETED_DEALS = 10;
export const MIN_COMPLETED_DEAL_SELLERS = 3;
export const MIN_COMPLETED_DEAL_BUYERS = 3;

const dealFactor = Prisma.sql`CASE d."unit" ${Prisma.join(UNIT_VALUES.map(unit => Prisma.sql`WHEN ${unit}::"ListingUnit" THEN ${UNIT_RULES[unit].factor}::numeric`), " ")} END`;
const dealBasis = Prisma.sql`CASE d."unit" ${Prisma.join(UNIT_VALUES.map(unit => Prisma.sql`WHEN ${unit}::"ListingUnit" THEN ${UNIT_RULES[unit].base}::text`), " ")} END`;
const eligibleDeals = Prisma.sql`
  SELECT d.id, d."sellerId", d."buyerId", d."completedAt", d."agreedPrice" AS "totalPrice",
    d."agreedPrice" / (d.quantity * (${dealFactor})) AS "unitPrice", (${dealBasis}) AS basis,
    p.commodity, p.variety, p.grade, p.category, p.country, p.location, p.item, p.description
  FROM "Deal" d JOIN "Product" p ON p.id = d."productId"
  WHERE d.status = 'COMPLETED'::"DealStatus" AND d."completedAt" IS NOT NULL
    AND d."agreedPrice" IS NOT NULL AND d."agreedPrice" > 0 AND d.currency = 'USD'
    AND d.quantity IS NOT NULL AND d.quantity > 0 AND d.unit IS NOT NULL
    AND p.commodity IS NOT NULL`;

type AggregateRow = {
  count: number; sellers: number; buyers: number; medianTotal: Prisma.Decimal | null;
  medianUnit: Prisma.Decimal | null; low: Prisma.Decimal | null; high: Prisma.Decimal | null;
};
type PeriodRow = { period: Date; count: number; sellers: number; buyers: number; median: Prisma.Decimal };
export type CompletedDealSummary = {
  count: number; medianTotal: string; medianUnit: string; low: string; high: string;
};
export type CompletedDealHistoryPoint = { period: string; count: number; median: string };
export type CompletedDealInsights = {
  summary: CompletedDealSummary | null;
  history: { granularity: "day" | "week" | null; points: CompletedDealHistoryPoint[]; trend: { current: string; previous: string; percentage: string } | null };
};

function predicate(filters: InsightFilters, now: Date, includeRange = true) {
  const clauses = [
    Prisma.sql`basis = ${filters.unit}`,
    Prisma.sql`commodity::text = ${filters.commodity}`,
    Prisma.sql`variety::text IS NOT DISTINCT FROM ${filters.variety || null}`,
    Prisma.sql`grade::text IS NOT DISTINCT FROM ${filters.grade || null}`,
  ];
  if (filters.q) clauses.push(Prisma.sql`(item ILIKE ${`%${filters.q}%`} OR description ILIKE ${`%${filters.q}%`})`);
  if (filters.category) clauses.push(Prisma.sql`category = ${filters.category}`);
  if (filters.country) clauses.push(Prisma.sql`country = ${filters.country}`);
  if (filters.location) clauses.push(Prisma.sql`location ILIKE ${`%${filters.location}%`}`);
  if (includeRange && filters.range !== "all") {
    const from = new Date(now.getTime() - Number(filters.range) * 86_400_000);
    clauses.push(Prisma.sql`"completedAt" >= ${from} AND "completedAt" <= ${now}`);
  }
  return Prisma.join(clauses, " AND ");
}

function publicEnough(row: Pick<AggregateRow, "count" | "sellers" | "buyers">) {
  return row.count >= MIN_COMPLETED_DEALS && row.sellers >= MIN_COMPLETED_DEAL_SELLERS && row.buyers >= MIN_COMPLETED_DEAL_BUYERS;
}

async function periodRows(filters: InsightFilters, granularity: "day" | "week", now: Date) {
  const period = granularity === "day" ? Prisma.sql`date_trunc('day', "completedAt" AT TIME ZONE 'UTC')` : Prisma.sql`date_trunc('week', "completedAt" AT TIME ZONE 'UTC')`;
  return prisma.$queryRaw<PeriodRow[]>(Prisma.sql`
    WITH deals AS (${eligibleDeals}), observations AS (
      SELECT *, ${period} AS period FROM deals WHERE ${predicate(filters, now)}
    ), ranked AS (
      SELECT *, ROW_NUMBER() OVER (PARTITION BY period ORDER BY "unitPrice", id) AS rn,
        COUNT(*) OVER (PARTITION BY period) AS n FROM observations
    )
    SELECT period, COUNT(*)::int AS count, COUNT(DISTINCT "sellerId")::int AS sellers,
      COUNT(DISTINCT "buyerId")::int AS buyers,
      AVG("unitPrice") FILTER (WHERE rn BETWEEN (n + 1) / 2 AND (n + 2) / 2) AS median
    FROM ranked GROUP BY period
    HAVING COUNT(*) >= ${MIN_COMPLETED_DEALS} AND COUNT(DISTINCT "sellerId") >= ${MIN_COMPLETED_DEAL_SELLERS}
      AND COUNT(DISTINCT "buyerId") >= ${MIN_COMPLETED_DEAL_BUYERS}
    ORDER BY period ASC`);
}

export async function completedDealInsights(filters: InsightFilters, now = new Date()): Promise<CompletedDealInsights> {
  if (!filters.commodity) return { summary: null, history: { granularity: null, points: [], trend: null } };
  const [aggregate] = await prisma.$queryRaw<AggregateRow[]>(Prisma.sql`
    WITH deals AS (${eligibleDeals}), ranked AS (
      SELECT *, ROW_NUMBER() OVER (ORDER BY "unitPrice", id) AS unit_rn,
        ROW_NUMBER() OVER (ORDER BY "totalPrice", id) AS total_rn, COUNT(*) OVER () AS n
      FROM deals WHERE ${predicate(filters, now)}
    )
    SELECT COUNT(*)::int AS count, COUNT(DISTINCT "sellerId")::int AS sellers,
      COUNT(DISTINCT "buyerId")::int AS buyers,
      AVG("totalPrice") FILTER (WHERE total_rn BETWEEN (n + 1) / 2 AND (n + 2) / 2) AS "medianTotal",
      AVG("unitPrice") FILTER (WHERE unit_rn BETWEEN (n + 1) / 2 AND (n + 2) / 2) AS "medianUnit",
      MIN("unitPrice") AS low, MAX("unitPrice") AS high FROM ranked`);
  const summary = aggregate && publicEnough(aggregate) && aggregate.medianUnit ? {
    count: aggregate.count, medianTotal: aggregate.medianTotal!.toString(), medianUnit: aggregate.medianUnit.toString(),
    low: aggregate.low!.toString(), high: aggregate.high!.toString(),
  } : null;
  if (!summary) return { summary: null, history: { granularity: null, points: [], trend: null } };
  const daily = await periodRows(filters, "day", now);
  const granularity = daily.length >= 2 ? "day" : "week";
  const rows = granularity === "day" ? daily : await periodRows(filters, "week", now);
  const points = rows.map(row => ({ period: row.period.toISOString(), count: row.count, median: row.median.toString() }));
  const latest = points.at(-1); const previous = points.at(-2);
  const trend = latest && previous && new ExactDecimal(previous.median).gt(0) ? {
    current: latest.median, previous: previous.median,
    percentage: new ExactDecimal(latest.median).minus(previous.median).div(previous.median).mul(100).toDecimalPlaces(1).toFixed(1),
  } : null;
  return { summary, history: { granularity: points.length ? granularity : null, points, trend } };
}

type SnapshotRow = AggregateRow & { commodity: Commodity; variety: Variety | null; grade: Grade | null; basis: ComparisonUnit };
export async function completedDealMarketSnapshot() {
  const rows = await prisma.$queryRaw<SnapshotRow[]>(Prisma.sql`
    WITH deals AS (${eligibleDeals}), ranked AS (
      SELECT *, ROW_NUMBER() OVER (PARTITION BY commodity, variety, grade, basis ORDER BY "unitPrice", id) AS unit_rn,
        ROW_NUMBER() OVER (PARTITION BY commodity, variety, grade, basis ORDER BY "totalPrice", id) AS total_rn,
        COUNT(*) OVER (PARTITION BY commodity, variety, grade, basis) AS n FROM deals
    )
    SELECT commodity, variety, grade, basis, COUNT(*)::int AS count,
      COUNT(DISTINCT "sellerId")::int AS sellers, COUNT(DISTINCT "buyerId")::int AS buyers,
      AVG("totalPrice") FILTER (WHERE total_rn BETWEEN (n + 1) / 2 AND (n + 2) / 2) AS "medianTotal",
      AVG("unitPrice") FILTER (WHERE unit_rn BETWEEN (n + 1) / 2 AND (n + 2) / 2) AS "medianUnit",
      MIN("unitPrice") AS low, MAX("unitPrice") AS high
    FROM ranked GROUP BY commodity, variety, grade, basis
    HAVING COUNT(*) >= ${MIN_COMPLETED_DEALS} AND COUNT(DISTINCT "sellerId") >= ${MIN_COMPLETED_DEAL_SELLERS}
      AND COUNT(DISTINCT "buyerId") >= ${MIN_COMPLETED_DEAL_BUYERS}
    ORDER BY count DESC, commodity, variety NULLS FIRST, grade NULLS FIRST, basis LIMIT 1`);
  return rows.map(row => ({ commodity: row.commodity, variety: row.variety, grade: row.grade, unit: row.basis, count: row.count, medianUnit: row.medianUnit!.toString() }));
}

export async function completedDealDiagnostics() {
  const [counts, cohorts] = await Promise.all([
    prisma.$queryRaw<{ completed: number; qualifying: number; excludedLegacy: number; latest: Date | null }[]>`
      SELECT COUNT(*)::int AS completed,
        COUNT(*) FILTER (WHERE "agreedPrice" IS NOT NULL AND quantity IS NOT NULL AND unit IS NOT NULL AND currency = 'USD')::int AS qualifying,
        COUNT(*) FILTER (WHERE "agreedPrice" IS NULL OR quantity IS NULL OR unit IS NULL OR currency IS NULL)::int AS "excludedLegacy",
        MAX("completedAt") FILTER (WHERE "agreedPrice" IS NOT NULL AND quantity IS NOT NULL AND unit IS NOT NULL AND currency = 'USD') AS latest
      FROM "Deal" WHERE status = 'COMPLETED'::"DealStatus"`,
    prisma.$queryRaw<{ total: number; publicCount: number; failed: number }[]>(Prisma.sql`
      WITH deals AS (${eligibleDeals}), grouped AS (
        SELECT commodity, variety, grade, basis, country, LOWER(BTRIM(location)) AS location,
          COUNT(*)::int AS count, COUNT(DISTINCT "sellerId")::int AS sellers, COUNT(DISTINCT "buyerId")::int AS buyers
        FROM deals GROUP BY commodity, variety, grade, basis, country, LOWER(BTRIM(location))
      ) SELECT COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE count >= ${MIN_COMPLETED_DEALS} AND sellers >= ${MIN_COMPLETED_DEAL_SELLERS} AND buyers >= ${MIN_COMPLETED_DEAL_BUYERS})::int AS "publicCount",
        COUNT(*) FILTER (WHERE count < ${MIN_COMPLETED_DEALS} OR sellers < ${MIN_COMPLETED_DEAL_SELLERS} OR buyers < ${MIN_COMPLETED_DEAL_BUYERS})::int AS failed FROM grouped`),
  ]);
  return { completed: counts[0].completed, qualifying: counts[0].qualifying, excludedLegacy: counts[0].excludedLegacy,
    latestQualifyingCompletion: counts[0].latest, cohortCoverage: cohorts[0].publicCount, privacyThresholdFailures: cohorts[0].failed, totalCohorts: cohorts[0].total };
}
