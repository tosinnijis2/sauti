import { z } from "zod";
import { marketFiltersSchema } from "./market-filters";
import { COMPARISON_UNITS } from "./units";
import { COMMODITIES, VARIETIES, GRADES } from "./commodities";

export const insightFiltersSchema = marketFiltersSchema.pick({ q: true, category: true, country: true, location: true, page: true }).extend({
  unit: z.enum(COMPARISON_UNITS).catch("KG"),
  commodity: z.union([z.enum(COMMODITIES), z.literal("")]).catch(""),
  variety: z.union([z.enum(VARIETIES), z.literal("")]).catch(""),
  grade: z.union([z.enum(GRADES), z.literal("")]).catch(""),
  range: z.enum(["30", "90", "180", "365", "all"]).catch("all"),
});
export type InsightFilters = z.infer<typeof insightFiltersSchema>;
