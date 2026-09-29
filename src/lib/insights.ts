import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { productCardSelect } from "./market";
import { marketWhere } from "./market-filters";
import { UNIT_VALUES, UNIT_RULES, PACKAGE_UNITS, CONTENT_UNITS, type ComparisonUnit } from "./units";
import { structuredSearch, type Commodity, type Variety, type Grade } from "./commodities";
import type { InsightFilters } from "./insight-filters";
import { historicalPriceHistory } from "./price-history";

export const MIN_INSIGHT_LISTINGS = 5;
export const INSIGHT_PAGE_SIZE = 12;
const validPrice = Prisma.sql`"status" = 'ACTIVE' AND "commodity" IS NOT NULL AND "price" > 0 AND "price" <= 9999999999.99 AND "quantity" > 0 AND "quantity" <= 999999999.999 AND "unit" IS NOT NULL`;
const measuredUnit = Prisma.sql`COALESCE("packageUnit", "unit")`;
const factor = Prisma.sql`CASE ${measuredUnit} ${Prisma.join(UNIT_VALUES.map(unit => Prisma.sql`WHEN ${unit}::"ListingUnit" THEN ${UNIT_RULES[unit].factor}::numeric`), " ")} END`;
const basis = Prisma.sql`CASE ${measuredUnit} ${Prisma.join(UNIT_VALUES.map(unit => Prisma.sql`WHEN ${unit}::"ListingUnit" THEN ${UNIT_RULES[unit].base}::text`), " ")} END`;
const normalizedRows = Prisma.sql`SELECT *, "price" / ("quantity" * COALESCE("packageQuantity", 1) * (${factor})) AS "unitPrice", (${basis}) AS basis FROM "Product" WHERE ${validPrice}`;

export function comparableWhere(filters: InsightFilters): Prisma.ProductWhereInput {
  return { AND: [marketWhere(filters), {
    commodity: filters.commodity || { in: [] }, variety: filters.variety || null, grade: filters.grade || null,
    price: { gt: 0, lte: "9999999999.99" }, quantity: { gt: 0, lte: "999999999.999" },
    OR: [
      { packageQuantity: null, packageUnit: null, unit: { in: UNIT_VALUES.filter(value => UNIT_RULES[value].base === filters.unit) } },
      { unit: { in: [...PACKAGE_UNITS] }, packageQuantity: { gt: 0, lte: "999999999.999" }, packageUnit: { in: CONTENT_UNITS.filter(value => UNIT_RULES[value].base === filters.unit) } },
    ],
  }] };
}

type Aggregate = { count: number; median: Prisma.Decimal | null; average: Prisma.Decimal | null; low: Prisma.Decimal | null; high: Prisma.Decimal | null };
export type PriceSummary = { count: number; median: string; average: string; low: string; high: string };
type LocationAggregate = Aggregate & { location: string; country: string | null };
export type InsightGroup = { commodity: Commodity; variety: Variety | null; grade: Grade | null; count: number };

function summarize(row: Aggregate): PriceSummary | null {
  if (row.count < MIN_INSIGHT_LISTINGS || row.median === null) return null;
  return { count: row.count, median: row.median.toString(), average: row.average!.toString(), low: row.low!.toString(), high: row.high!.toString() };
}

function broadPredicate({ q, category, country, location, unit }: InsightFilters) {
  const clauses = [Prisma.sql`basis = ${unit}`];
  if (q) {
    const matches = structuredSearch(q);
    const search = [Prisma.sql`"item" ILIKE ${`%${q}%`}`, Prisma.sql`"description" ILIKE ${`%${q}%`}`];
    if (matches.commodities.length) search.push(Prisma.sql`"commodity"::text IN (${Prisma.join(matches.commodities)})`);
    if (matches.varieties.length) search.push(Prisma.sql`"variety"::text IN (${Prisma.join(matches.varieties)})`);
    if (matches.grades.length) search.push(Prisma.sql`"grade"::text IN (${Prisma.join(matches.grades)})`);
    clauses.push(Prisma.sql`(${Prisma.join(search, " OR ")})`);
  }
  if (category) clauses.push(Prisma.sql`"category" = ${category}`);
  if (country) clauses.push(Prisma.sql`"country" = ${country}`);
  if (location) clauses.push(Prisma.sql`"location" ILIKE ${`%${location}%`}`);
  return Prisma.join(clauses, " AND ");
}

function exactPredicate(filters: InsightFilters) {
  return Prisma.sql`${broadPredicate(filters)} AND "commodity"::text = ${filters.commodity}
    AND "variety"::text IS NOT DISTINCT FROM ${filters.variety || null}
    AND "grade"::text IS NOT DISTINCT FROM ${filters.grade || null}`;
}

// Numeric middle-row averaging avoids percentile_cont's double-precision coercion.
const aggregateColumns = Prisma.sql`COUNT(*)::int AS count,
  AVG("unitPrice") FILTER (WHERE rn BETWEEN (n + 1) / 2 AND (n + 2) / 2) AS median,
  AVG("unitPrice") AS average, MIN("unitPrice") AS low, MAX("unitPrice") AS high`;
function ranked(predicate: Prisma.Sql, partition = Prisma.empty) {
  return Prisma.sql`WITH prices AS (${normalizedRows}), ranked AS (
    SELECT *, ROW_NUMBER() OVER (${partition} ORDER BY "unitPrice", id) AS rn,
      COUNT(*) OVER (${partition}) AS n FROM prices WHERE ${predicate}
  )`;
}

export async function marketInsights(filters: InsightFilters) {
  const predicate = exactPredicate(filters);
  return prisma.$transaction(async tx => {
    const [aggregate] = await tx.$queryRaw<Aggregate[]>(Prisma.sql`${ranked(predicate)} SELECT ${aggregateColumns} FROM ranked`);
    const page = Math.min(filters.page, Math.max(1, Math.ceil(aggregate.count / INSIGHT_PAGE_SIZE)));
    const [locations, products, groups] = await Promise.all([
      tx.$queryRaw<LocationAggregate[]>(Prisma.sql`
        ${ranked(Prisma.sql`${predicate} AND BTRIM("location") <> ''`, Prisma.sql`PARTITION BY LOWER(BTRIM("location")), "country"`)}
        SELECT MIN(BTRIM("location")) AS location, "country", ${aggregateColumns} FROM ranked
        GROUP BY LOWER(BTRIM("location")), "country" HAVING COUNT(*) >= ${MIN_INSIGHT_LISTINGS}
        ORDER BY count DESC, location ASC, "country" ASC NULLS LAST LIMIT 8`),
      tx.product.findMany({ where: comparableWhere(filters), select: productCardSelect,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (page - 1) * INSIGHT_PAGE_SIZE, take: INSIGHT_PAGE_SIZE }),
      tx.$queryRaw<InsightGroup[]>(Prisma.sql`WITH prices AS (${normalizedRows})
        SELECT "commodity", "variety", "grade", COUNT(*)::int AS count FROM prices WHERE ${broadPredicate(filters)}
        GROUP BY "commodity", "variety", "grade" ORDER BY count DESC, "commodity", "variety" NULLS FIRST, "grade" NULLS FIRST LIMIT 100`),
    ]);
    return { count: aggregate.count, summary: summarize(aggregate), page, products, groups,
      locations: locations.map(row => ({ location: row.location, country: row.country, ...summarize(row)! })) };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
}

export async function marketSnapshot(userId: string) {
  const rows = await prisma.$queryRaw<(Aggregate & InsightGroup & { basis: ComparisonUnit })[]>(Prisma.sql`
    ${ranked(Prisma.sql`TRUE`, Prisma.sql`PARTITION BY "commodity", "variety", "grade", basis`)},
    saved_groups AS (
      SELECT DISTINCT p."commodity", p."variety", p."grade" FROM "Favorite" f JOIN "Product" p ON p.id = f."productId"
      WHERE f."userId" = ${userId} AND p."commodity" IS NOT NULL
    ), cohorts AS (
      SELECT "commodity", "variety", "grade", basis, ${aggregateColumns} FROM ranked
      GROUP BY "commodity", "variety", "grade", basis HAVING COUNT(*) >= ${MIN_INSIGHT_LISTINGS}
    )
    SELECT c.* FROM cohorts c LEFT JOIN saved_groups s ON c."commodity" = s."commodity"
      AND c."variety" IS NOT DISTINCT FROM s."variety" AND c."grade" IS NOT DISTINCT FROM s."grade"
    ORDER BY (s."commodity" IS NOT NULL) DESC, c.count DESC, c."commodity", c."variety" NULLS FIRST, c."grade" NULLS FIRST, c.basis LIMIT 3`);
  return Promise.all(rows.map(async row => {
    const history = await historicalPriceHistory({ q: "", category: "", country: "", location: "", page: 1, commodity: row.commodity, variety: row.variety ?? "", grade: row.grade ?? "", unit: row.basis, range: "all" });
    return { commodity: row.commodity, variety: row.variety, grade: row.grade, unit: row.basis, ...summarize(row)!, trend: history.trend?.percentage ?? null };
  }));
}
