import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { COMMODITIES, GRADES, structuredSearch, VARIETIES } from "./commodities";
import { UNIT_VALUES } from "./units";
import { countries } from "./countries";

const optionalPrice = z.string().trim().regex(/^\d{1,10}(\.\d{1,2})?$/).or(z.literal("")).catch("");
export const MARKET_SORTS = ["relevance", "newest", "price_asc", "price_desc", "unit_asc", "unit_desc"] as const;

export const marketFiltersSchema = z.object({
  q: z.string().trim().max(120).transform(value => value.replace(/\s+/g, " ")).catch(""),
  category: z.string().trim().max(100).catch(""),
  commodity: z.union([z.enum(COMMODITIES), z.literal("")]).catch(""),
  variety: z.union([z.enum(VARIETIES), z.literal("")]).catch(""),
  grade: z.union([z.enum(GRADES), z.literal("")]).catch(""),
  location: z.string().trim().max(120).transform(value => value.replace(/\s+/g, " ")).catch(""),
  country: z.string().trim().toUpperCase().length(2).catch(""),
  unit: z.union([z.enum(UNIT_VALUES), z.literal("")]).catch(""),
  minPrice: optionalPrice,
  maxPrice: optionalPrice,
  sort: z.enum(MARKET_SORTS).catch("relevance"),
  page: z.coerce.number().int().min(1).max(100000).catch(1),
});
export type MarketFilters = z.infer<typeof marketFiltersSchema>;

export function matchingCountryCodes(q: string) {
  const term = q.toLowerCase();
  return countries.filter(country => country.code.toLowerCase() === term || country.name.toLowerCase().includes(term)).map(country => country.code);
}

export function marketWhere({ q, category, country, location }: Pick<MarketFilters, "q" | "category" | "country" | "location"> & Partial<MarketFilters>): Prisma.ProductWhereInput {
  const search = structuredSearch(q);
  const countryCodes = matchingCountryCodes(q);
  return {
    status: "ACTIVE",
    ...(q ? { OR: [
      { item: { contains: q, mode: "insensitive" as const } }, { description: { contains: q, mode: "insensitive" as const } },
      { category: { contains: q, mode: "insensitive" as const } }, { location: { contains: q, mode: "insensitive" as const } },
      { country: { in: countryCodes } }, { commodity: { in: search.commodities } }, { variety: { in: search.varieties } }, { grade: { in: search.grades } },
    ] } : {}),
    ...(category ? { category } : {}),
    ...(country ? { country } : {}), ...(location ? { location: { contains: location, mode: "insensitive" as const } } : {}),
  };
}
