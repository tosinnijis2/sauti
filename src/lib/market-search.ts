import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { COMMODITY_LABELS, GRADE_LABELS, structuredSearch, VARIETY_LABELS } from "./commodities";
import { matchingCountryCodes, type MarketFilters } from "./market-filters";
import { productCardSelect } from "./market";
import { PACKAGE_UNITS, UNIT_RULES } from "./units";

export const MARKET_PAGE_SIZE = 12;
type IdRow = { id: string };
type CountRow = { count: number };

export function marketPredicateSql(filters: MarketFilters) {
  const clauses = [Prisma.sql`p.status = 'ACTIVE'::"ListingStatus"`];
  if (filters.q) {
    const pattern = `%${filters.q}%`;
    const structured = structuredSearch(filters.q);
    const countryCodes = matchingCountryCodes(filters.q);
    const matches = [Prisma.sql`p.item ILIKE ${pattern}`, Prisma.sql`p.description ILIKE ${pattern}`, Prisma.sql`p.category ILIKE ${pattern}`, Prisma.sql`p.location ILIKE ${pattern}`];
    if (countryCodes.length) matches.push(Prisma.sql`p.country IN (${Prisma.join(countryCodes)})`);
    if (structured.commodities.length) matches.push(Prisma.sql`p.commodity::text IN (${Prisma.join(structured.commodities)})`);
    if (structured.varieties.length) matches.push(Prisma.sql`p.variety::text IN (${Prisma.join(structured.varieties)})`);
    if (structured.grades.length) matches.push(Prisma.sql`p.grade::text IN (${Prisma.join(structured.grades)})`);
    clauses.push(Prisma.sql`(${Prisma.join(matches, " OR ")})`);
  }
  if (filters.category) clauses.push(Prisma.sql`p.category = ${filters.category}`);
  if (filters.commodity) clauses.push(Prisma.sql`p.commodity::text = ${filters.commodity}`);
  if (filters.variety) clauses.push(Prisma.sql`p.variety::text = ${filters.variety}`);
  if (filters.grade) clauses.push(Prisma.sql`p.grade::text = ${filters.grade}`);
  if (filters.country) clauses.push(Prisma.sql`p.country = ${filters.country}`);
  if (filters.location) clauses.push(Prisma.sql`LOWER(REGEXP_REPLACE(BTRIM(p.location), '[[:space:]]+', ' ', 'g')) LIKE ${`%${filters.location.toLowerCase()}%`}`);
  if (filters.unit) clauses.push(Prisma.sql`p.unit::text = ${filters.unit}`);
  if (filters.minPrice) clauses.push(Prisma.sql`p.price >= ${filters.minPrice}::numeric`);
  if (filters.maxPrice) clauses.push(Prisma.sql`p.price <= ${filters.maxPrice}::numeric`);
  return Prisma.join(clauses, " AND ");
}

function relevance(filters: MarketFilters) {
  if (!filters.q) return Prisma.sql`0`;
  const q = filters.q.toLowerCase(); const pattern = `%${filters.q}%`; const prefix = `${filters.q}%`;
  const structured = structuredSearch(filters.q);
  const countryCodes = matchingCountryCodes(filters.q);
  const commodityLabels = structured.commodities.map(value => COMMODITY_LABELS[value].toLowerCase());
  const varietyLabels = structured.varieties.map(value => VARIETY_LABELS[value].toLowerCase());
  const gradeLabels = structured.grades.map(value => GRADE_LABELS[value].toLowerCase());
  return Prisma.sql`(
    CASE WHEN LOWER(p.item) = ${q} THEN 160 WHEN p.item ILIKE ${prefix} THEN 130 WHEN p.item ILIKE ${pattern} THEN 100 ELSE 0 END +
    CASE WHEN ${commodityLabels.length ? Prisma.sql`LOWER(REPLACE(p.commodity::text, '_', ' ')) IN (${Prisma.join(commodityLabels)})` : Prisma.sql`FALSE`} THEN 90 ELSE 0 END +
    CASE WHEN p.category ILIKE ${pattern} THEN 60 ELSE 0 END +
    CASE WHEN ${varietyLabels.length ? Prisma.sql`LOWER(REPLACE(p.variety::text, '_', ' ')) IN (${Prisma.join(varietyLabels)})` : Prisma.sql`FALSE`} THEN 55 ELSE 0 END +
    CASE WHEN ${gradeLabels.length ? Prisma.sql`LOWER(REPLACE(p.grade::text, '_', ' ')) IN (${Prisma.join(gradeLabels)})` : Prisma.sql`FALSE`} THEN 50 ELSE 0 END +
    CASE WHEN p.location ILIKE ${pattern} OR ${countryCodes.length ? Prisma.sql`p.country IN (${Prisma.join(countryCodes)})` : Prisma.sql`FALSE`} THEN 35 ELSE 0 END +
    CASE WHEN p.description ILIKE ${pattern} THEN 10 ELSE 0 END
  )`;
}

function order(filters: MarketFilters) {
  if (filters.sort === "price_asc") return Prisma.sql`p.price ASC, p."createdAt" DESC, p.id DESC`;
  if (filters.sort === "price_desc") return Prisma.sql`p.price DESC, p."createdAt" DESC, p.id DESC`;
  if (["unit_asc", "unit_desc"].includes(filters.sort) && filters.unit && !PACKAGE_UNITS.includes(filters.unit)) {
    const factor = UNIT_RULES[filters.unit].factor;
    const direction = filters.sort === "unit_asc" ? Prisma.sql`ASC` : Prisma.sql`DESC`;
    return Prisma.sql`CASE WHEN p.quantity > 0 THEN p.price / (p.quantity * ${factor}::numeric) END ${direction} NULLS LAST, p."createdAt" DESC, p.id DESC`;
  }
  if (filters.sort === "relevance" && filters.q) return Prisma.sql`${relevance(filters)} DESC, p."createdAt" DESC, p.id DESC`;
  return Prisma.sql`p."createdAt" DESC, p.id DESC`;
}

export function effectiveMarketSort(filters: MarketFilters) {
  return ["unit_asc", "unit_desc"].includes(filters.sort) && (!filters.unit || PACKAGE_UNITS.includes(filters.unit)) ? "newest" : filters.sort;
}

export async function searchMarket(filters: MarketFilters) {
  const where = marketPredicateSql(filters);
  const safeFilters = { ...filters, sort: effectiveMarketSort(filters) };
  const [ids, counts] = await prisma.$transaction([
    prisma.$queryRaw<IdRow[]>(Prisma.sql`SELECT p.id FROM "Product" p WHERE ${where} ORDER BY ${order(safeFilters)} OFFSET ${(filters.page - 1) * MARKET_PAGE_SIZE} LIMIT ${MARKET_PAGE_SIZE}`),
    prisma.$queryRaw<CountRow[]>(Prisma.sql`SELECT COUNT(*)::int AS count FROM "Product" p WHERE ${where}`),
  ]);
  const rows = ids.length ? await prisma.product.findMany({ where: { id: { in: ids.map(row => row.id) } }, select: productCardSelect }) : [];
  const byId = new Map(rows.map(row => [row.id, row]));
  return { products: ids.map(row => byId.get(row.id)).filter((row): row is NonNullable<typeof row> => Boolean(row)), total: counts[0]?.count ?? 0, sort: safeFilters.sort };
}
