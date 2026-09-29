import "server-only";
import { Prisma, type Commodity, type CommodityVariety, type ListingUnit, type PriceWatchCondition, type SellerGrade } from "@prisma/client";
import { z } from "zod";
import { prisma } from "./prisma";
import { COMMODITIES, VARIETIES, GRADES, COMMODITY_VARIETIES } from "./commodities";
import { COMPARISON_UNITS } from "./units";
import { isCountry } from "./countries";
import { ExactDecimal } from "./decimal";

const threshold = z.string().trim().regex(/^\d{1,10}(\.\d{1,4})?$/).refine(value => new ExactDecimal(value).gt(0), "Enter a threshold greater than zero.");
export const watchInputSchema = z.object({
  commodity: z.enum(COMMODITIES),
  variety: z.union([z.enum(VARIETIES), z.literal("")]).default(""),
  grade: z.union([z.enum(GRADES), z.literal("")]).default(""),
  normalizedUnit: z.enum(COMPARISON_UNITS),
  country: z.string().trim().refine(value => !value || isCountry(value), "Choose a valid country."),
  location: z.string().trim().max(120),
  condition: z.enum(["BELOW", "ABOVE", "PERCENT_DROP", "PERCENT_RISE"]),
  threshold,
}).superRefine((data, ctx) => {
  if (data.variety && !COMMODITY_VARIETIES[data.commodity].includes(data.variety)) ctx.addIssue({ code: "custom", path: ["variety"], message: "Choose a variety for this commodity." });
  if (data.condition.startsWith("PERCENT") && new ExactDecimal(data.threshold).gt(1000)) ctx.addIssue({ code: "custom", path: ["threshold"], message: "Percentage threshold must be 1,000 or less." });
});

export class PriceWatchError extends Error {}
type Cohort = { commodity: Commodity; variety: CommodityVariety | null; grade: SellerGrade | null; normalizedUnit: ListingUnit; country: string | null; location: string | null };

export function watchCohortKey(cohort: Cohort) {
  return JSON.stringify([cohort.commodity, cohort.variety, cohort.grade, cohort.normalizedUnit, cohort.country, cohort.location?.toLocaleLowerCase("en") ?? null]);
}

export async function createPriceWatch(userId: string, raw: unknown) {
  const parsed = watchInputSchema.safeParse(raw);
  if (!parsed.success) throw new PriceWatchError(parsed.error.issues[0]?.message ?? "Check the watch details.");
  const value = parsed.data;
  const cohort = { commodity: value.commodity, variety: value.variety || null, grade: value.grade || null, normalizedUnit: value.normalizedUnit, country: value.country || null, location: value.location || null };
  try {
    return await prisma.priceWatch.create({ data: { userId, ...cohort, cohortKey: watchCohortKey(cohort), condition: value.condition, threshold: value.threshold } });
  } catch (cause) {
    if (cause instanceof Prisma.PrismaClientKnownRequestError && cause.code === "P2002") throw new PriceWatchError("You already have this price watch.");
    throw cause;
  }
}

export async function setPriceWatchEnabled(userId: string, id: string, enabled: boolean) {
  const result = await prisma.priceWatch.updateMany({ where: { id, userId }, data: { enabled } });
  if (!result.count) throw new PriceWatchError("Price watch not found.");
}

export async function deletePriceWatch(userId: string, id: string) {
  const result = await prisma.priceWatch.deleteMany({ where: { id, userId } });
  if (!result.count) throw new PriceWatchError("Price watch not found.");
}

export function conditionLabel(condition: PriceWatchCondition, value: Prisma.Decimal | string, unit: string) {
  const thresholdValue = new ExactDecimal(value.toString()).toDecimalPlaces(4).toString();
  if (condition === "BELOW") return `Median falls below $${thresholdValue}/${unit}`;
  if (condition === "ABOVE") return `Median rises above $${thresholdValue}/${unit}`;
  return `Median ${condition === "PERCENT_DROP" ? "drops" : "rises"} by ${thresholdValue}%`;
}
