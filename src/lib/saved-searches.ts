import "server-only";
import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { marketFiltersSchema, matchingCountryCodes, type MarketFilters } from "./market-filters";
import { marketPredicateSql } from "./market-search";
import { structuredSearch } from "./commodities";

export class SavedSearchError extends Error {}

const criteriaKeys = ["q", "category", "commodity", "variety", "grade", "country", "location", "unit", "minPrice", "maxPrice"] as const;
export type SavedSearchCriteria = Pick<MarketFilters, (typeof criteriaKeys)[number]> & Pick<MarketFilters, "sort">;

export function normalizeSavedSearch(raw: Record<string, unknown>): SavedSearchCriteria {
  const parsed = marketFiltersSchema.parse(raw);
  if (parsed.minPrice && parsed.maxPrice && new Prisma.Decimal(parsed.minPrice).gt(parsed.maxPrice)) throw new SavedSearchError("Minimum price cannot exceed maximum price.");
  return { q: parsed.q, category: parsed.category, commodity: parsed.commodity, variety: parsed.variety, grade: parsed.grade, country: parsed.country, location: parsed.location, unit: parsed.unit, minPrice: parsed.minPrice, maxPrice: parsed.maxPrice, sort: parsed.sort };
}

export function hasMeaningfulSavedSearch(criteria: SavedSearchCriteria) {
  return criteriaKeys.some(key => Boolean(criteria[key]));
}

export function savedSearchCanonicalKey(criteria: SavedSearchCriteria) {
  const canonical = criteriaKeys.map(key => {
    const value = criteria[key];
    return [key, typeof value === "string" ? value.trim().toLowerCase() : value];
  });
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

export function savedSearchUrl(criteria: SavedSearchCriteria) {
  const params = new URLSearchParams();
  for (const key of [...criteriaKeys, "sort"] as const) {
    const value = criteria[key];
    if (!value || (key === "sort" && value === "relevance")) continue;
    params.set(key, value);
  }
  return `/market${params.size ? `?${params}` : ""}`;
}

function defaultName(criteria: SavedSearchCriteria) {
  if (criteria.q) return criteria.q;
  const parts = [criteria.commodity, criteria.category, criteria.location, criteria.country].filter(Boolean);
  return parts.length ? parts.join(" in ") : "Marketplace search";
}

export async function createSavedSearch(userId: string, raw: Record<string, unknown>) {
  const criteria = normalizeSavedSearch(raw);
  if (!hasMeaningfulSavedSearch(criteria)) throw new SavedSearchError("Add a search term or filter before saving this search.");
  const suppliedName = String(raw.name ?? "").trim().replace(/\s+/g, " ");
  if (suppliedName.length > 80) throw new SavedSearchError("Search name must be 80 characters or fewer.");
  const data = {
    ...criteria,
    name: suppliedName || defaultName(criteria),
    q: criteria.q,
    category: criteria.category || null,
    commodity: criteria.commodity || null,
    variety: criteria.variety || null,
    grade: criteria.grade || null,
    country: criteria.country || null,
    location: criteria.location || null,
    unit: criteria.unit || null,
    minPrice: criteria.minPrice || null,
    maxPrice: criteria.maxPrice || null,
    queryCountryCodes: matchingCountryCodes(criteria.q),
    queryCommodities: structuredSearch(criteria.q).commodities,
    queryVarieties: structuredSearch(criteria.q).varieties,
    queryGrades: structuredSearch(criteria.q).grades,
    canonicalKey: savedSearchCanonicalKey(criteria),
  };
  try {
    return await prisma.$transaction(async tx => {
      const savedSearch = await tx.savedSearch.create({ data: { ...data, userId } });
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO "SavedSearchMatch" ("savedSearchId", "productId", "firstMatchedAt")
        SELECT ${savedSearch.id}, p.id, CURRENT_TIMESTAMP FROM "Product" p
        WHERE ${marketPredicateSql({ ...criteria, page: 1 })}
        ON CONFLICT DO NOTHING`);
      await tx.savedSearch.update({ where: { id: savedSearch.id }, data: { lastEvaluatedAt: new Date() } });
      return savedSearch;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new SavedSearchError("You already saved this search.");
    throw error;
  }
}

export async function renameSavedSearch(userId: string, id: string, rawName: string) {
  const name = rawName.trim().replace(/\s+/g, " ");
  if (!name || name.length > 80) throw new SavedSearchError("Search name must be between 1 and 80 characters.");
  const result = await prisma.savedSearch.updateMany({ where: { id, userId }, data: { name } });
  if (!result.count) throw new SavedSearchError("Saved search not found.");
}

export async function setSavedSearchEnabled(userId: string, id: string, enabled: boolean) {
  const result = await prisma.savedSearch.updateMany({ where: { id, userId }, data: { enabled } });
  if (!result.count) throw new SavedSearchError("Saved search not found.");
}

export async function deleteSavedSearch(userId: string, id: string) {
  const result = await prisma.savedSearch.deleteMany({ where: { id, userId } });
  if (!result.count) throw new SavedSearchError("Saved search not found.");
}
