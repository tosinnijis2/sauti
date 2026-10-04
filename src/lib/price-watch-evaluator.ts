import "server-only";
import { type PriceWatch, type Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { historicalPriceHistory } from "./price-history";
import { marketInsights } from "./insights";
import { ExactDecimal } from "./decimal";
import { cohortLabel } from "./commodities";
import { COMPARISON_UNITS, UNIT_RULES, type ComparisonUnit } from "./units";
import { conditionLabel } from "./price-watches";
import type { InsightFilters } from "./insight-filters";
import { deliverPendingPriceAlertEmails } from "./notification-delivery";

export type WatchEvaluationSummary = { scanned: number; evaluated: number; insufficient: number; triggered: number; suppressed: number; errors: number };

// Enabled watches are evaluated in bounded batches so a large pilot never loads the
// whole watch table into memory in one scheduled run.
const WATCH_BATCH_SIZE = 200;

function measurement(watch: PriceWatch, current: string, percentage: string | undefined) {
  if (watch.condition === "BELOW") return { value: current, met: new ExactDecimal(current).lt(watch.threshold.toString()) };
  if (watch.condition === "ABOVE") return { value: current, met: new ExactDecimal(current).gt(watch.threshold.toString()) };
  if (percentage === undefined) return null;
  const value = new ExactDecimal(percentage);
  return { value: percentage, met: watch.condition === "PERCENT_DROP" ? value.lte(new ExactDecimal(watch.threshold.toString()).negated()) : value.gte(watch.threshold.toString()) };
}

const watchInclude = { user: { select: { emailVerifiedAt: true, notificationPreference: { select: { inAppPriceAlerts: true, emailPriceAlerts: true } } } } } satisfies Prisma.PriceWatchInclude;
type EvaluatedWatch = Prisma.PriceWatchGetPayload<{ include: typeof watchInclude }>;

export async function evaluatePriceWatches(now = new Date()): Promise<WatchEvaluationSummary> {
  const summary: WatchEvaluationSummary = { scanned: 0, evaluated: 0, insufficient: 0, triggered: 0, suppressed: 0, errors: 0 };
  const evaluateOne = async (watch: EvaluatedWatch) => {
    try {
      if (!COMPARISON_UNITS.includes(watch.normalizedUnit as ComparisonUnit)) { summary.insufficient++; return; }
      const unit = watch.normalizedUnit as ComparisonUnit;
      const filters: InsightFilters = { q: "", category: "", page: 1, range: "all", commodity: watch.commodity, variety: watch.variety ?? "", grade: watch.grade ?? "", unit, country: watch.country ?? "", location: watch.location ?? "" };
      const [history, live] = await Promise.all([historicalPriceHistory(filters, now), marketInsights(filters)]);
      const latest = history.points.at(-1);
      const result = live.summary && latest ? measurement(watch, live.summary.median, history.trend?.percentage) : null;
      if (!result) {
        summary.insufficient++;
        await prisma.priceWatch.update({ where: { id: watch.id }, data: { lastEvaluatedAt: now, lastValue: null } });
        return;
      }
      summary.evaluated++;
      const crossing = result.met && watch.lastConditionMet !== true;
      const alertsEnabled = watch.user.notificationPreference?.inAppPriceAlerts ?? true;
      const outcome = await prisma.$transaction(async tx => {
        const changed = await tx.priceWatch.updateMany({ where: { id: watch.id, lastConditionMet: watch.lastConditionMet }, data: { lastConditionMet: result.met, lastValue: result.value, lastEvaluatedAt: now } });
        if (!changed.count || !crossing) return "none" as const;
        if (!alertsEnabled) return "suppressed" as const;
        const cohort = cohortLabel(watch.commodity, watch.variety, watch.grade);
        const unitLabel = UNIT_RULES[unit].label;
        const href = "/market/insights?" + new URLSearchParams({ commodity: watch.commodity, variety: watch.variety ?? "", grade: watch.grade ?? "", unit, country: watch.country ?? "", location: watch.location ?? "", range: "all" });
        const notification = await tx.notification.create({ data: { userId: watch.userId, watchId: watch.id, type: "PRICE_ALERT", title: `${cohort} price watch triggered`, message: `${conditionLabel(watch.condition, watch.threshold, unitLabel)}. Latest qualifying value: ${watch.condition.startsWith("PERCENT") ? `${result.value}%` : `$${result.value}/${unitLabel}`}.`, href } });
        if (watch.user.emailVerifiedAt && watch.user.notificationPreference?.emailPriceAlerts) {
          await tx.notificationEmailDelivery.create({ data: { notificationId: notification.id, cohort, trigger: conditionLabel(watch.condition, watch.threshold, unitLabel), currentMedian: live.summary!.median, unit: unitLabel, country: watch.country, location: watch.location, href } });
        }
        return "triggered" as const;
      });
      if (outcome === "triggered") summary.triggered++;
      else if (outcome === "suppressed") summary.suppressed++;
    } catch {
      summary.errors++;
      console.error("[price-watch]", JSON.stringify({ watchId: watch.id, operation: "evaluate", timestamp: now.toISOString(), context: "watch evaluation failed" }));
    }
  };
  // Cursor paging keeps memory bounded; every enabled watch is still evaluated exactly once.
  let cursor: string | undefined;
  for (;;) {
    const batch = await prisma.priceWatch.findMany({ where: { enabled: true, ...(cursor ? { id: { gt: cursor } } : {}) }, orderBy: { id: "asc" }, take: WATCH_BATCH_SIZE, include: watchInclude });
    if (!batch.length) break;
    cursor = batch[batch.length - 1].id;
    summary.scanned += batch.length;
    for (const watch of batch) await evaluateOne(watch);
  }
  await deliverPendingPriceAlertEmails(now);
  return summary;
}
