import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { structuredSearch } from "./commodities";

export const marketFiltersSchema = z.object({
  q: z.string().trim().max(120).catch(""), category: z.string().trim().max(100).catch(""),
  location: z.string().trim().max(120).catch(""), country: z.string().max(2).catch(""),
  page: z.coerce.number().int().min(1).max(100000).catch(1),
});
export type MarketFilters = z.infer<typeof marketFiltersSchema>;

export function marketWhere({ q, category, country, location }: MarketFilters): Prisma.ProductWhereInput {
  const search = structuredSearch(q);
  return {
    status: "ACTIVE",
    ...(q ? { OR: [{ item: { contains: q, mode: "insensitive" as const } }, { description: { contains: q, mode: "insensitive" as const } }, { commodity: { in: search.commodities } }, { variety: { in: search.varieties } }, { grade: { in: search.grades } }] } : {}),
    ...(category ? { category } : {}), ...(country ? { country } : {}),
    ...(location ? { location: { contains: location, mode: "insensitive" as const } } : {}),
  };
}
