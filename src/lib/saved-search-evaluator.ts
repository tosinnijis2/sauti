import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { savedSearchUrl, type SavedSearchCriteria } from "./saved-searches";
import type { WatchEvaluationSummary } from "./price-watch-evaluator";
import { countryName } from "./countries";

type MatchRow = {
  savedSearchId: string; userId: string; name: string; q: string; category: string | null;
  commodity: string | null; variety: string | null; grade: string | null; country: string | null;
  location: string | null; unit: string | null; minPrice: Prisma.Decimal | null; maxPrice: Prisma.Decimal | null;
  sort: string; productId: string; item: string; price: Prisma.Decimal; productLocation: string; productCountry: string | null;
};

function criteria(row: MatchRow): SavedSearchCriteria {
  return { q: row.q, category: row.category ?? "", commodity: (row.commodity ?? "") as SavedSearchCriteria["commodity"], variety: (row.variety ?? "") as SavedSearchCriteria["variety"], grade: (row.grade ?? "") as SavedSearchCriteria["grade"], country: row.country ?? "", location: row.location ?? "", unit: (row.unit ?? "") as SavedSearchCriteria["unit"], minPrice: row.minPrice?.toString() ?? "", maxPrice: row.maxPrice?.toString() ?? "", sort: row.sort as SavedSearchCriteria["sort"] };
}

export async function evaluateSavedSearches(now = new Date()): Promise<WatchEvaluationSummary> {
  const searches = await prisma.savedSearch.findMany({ where: { enabled: true }, select: { id: true } });
  const summary: WatchEvaluationSummary = { scanned: searches.length, evaluated: 0, insufficient: 0, triggered: 0, suppressed: 0, errors: 0 };
  if (!searches.length) return summary;
  const rows = await prisma.$queryRaw<MatchRow[]>(Prisma.sql`
    SELECT s.id AS "savedSearchId", s."userId", s.name, s.q, s.category, s.commodity::text, s.variety::text, s.grade::text,
      s.country, s.location, s.unit::text, s."minPrice", s."maxPrice", s.sort,
      p.id AS "productId", p.item, p.price, p.location AS "productLocation", p.country AS "productCountry"
    FROM "SavedSearch" s
    JOIN "Product" p ON p.status = 'ACTIVE'::"ListingStatus"
      AND (s.q = '' OR p.item ILIKE '%' || s.q || '%' OR p.description ILIKE '%' || s.q || '%' OR p.category ILIKE '%' || s.q || '%'
        OR p.location ILIKE '%' || s.q || '%' OR LOWER(REPLACE(p.commodity::text, '_', ' ')) LIKE '%' || LOWER(s.q) || '%'
        OR LOWER(REPLACE(p.variety::text, '_', ' ')) LIKE '%' || LOWER(s.q) || '%' OR LOWER(REPLACE(p.grade::text, '_', ' ')) LIKE '%' || LOWER(s.q) || '%'
        OR p.country = ANY(s."queryCountryCodes") OR p.commodity = ANY(s."queryCommodities")
        OR p.variety = ANY(s."queryVarieties") OR p.grade = ANY(s."queryGrades"))
      AND (s.category IS NULL OR p.category = s.category)
      AND (s.commodity IS NULL OR p.commodity = s.commodity)
      AND (s.variety IS NULL OR p.variety = s.variety)
      AND (s.grade IS NULL OR p.grade = s.grade)
      AND (s.country IS NULL OR p.country = s.country)
      AND (s.location IS NULL OR LOWER(REGEXP_REPLACE(BTRIM(p.location), '[[:space:]]+', ' ', 'g')) LIKE '%' || LOWER(s.location) || '%')
      AND (s.unit IS NULL OR p.unit = s.unit)
      AND (s."minPrice" IS NULL OR p.price >= s."minPrice")
      AND (s."maxPrice" IS NULL OR p.price <= s."maxPrice")
    LEFT JOIN "SavedSearchMatch" m ON m."savedSearchId" = s.id AND m."productId" = p.id
    WHERE s.enabled = true AND m."productId" IS NULL
    ORDER BY s.id, p."createdAt" DESC, p.id DESC`);
  const grouped = new Map<string, MatchRow[]>();
  for (const row of rows) grouped.set(row.savedSearchId, [...(grouped.get(row.savedSearchId) ?? []), row]);
  await prisma.savedSearch.updateMany({ where: { enabled: true }, data: { lastEvaluatedAt: now } });
  summary.evaluated = searches.length;
  for (const [savedSearchId, matches] of grouped) {
    try {
      const outcome = await prisma.$transaction(async tx => {
        const locked = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`SELECT id FROM "SavedSearch" WHERE id = ${savedSearchId} AND enabled = true FOR UPDATE`);
        if (!locked.length) return 0;
        const inserted = await tx.savedSearchMatch.createMany({ data: matches.map(row => ({ savedSearchId, productId: row.productId, firstMatchedAt: now })), skipDuplicates: true });
        if (!inserted.count) return 0;
        const first = matches[0];
        const place = [first.productLocation, first.productCountry ? countryName(first.productCountry) : ""].filter(Boolean).join(", ");
        const title = inserted.count === 1 ? `New listing matches '${first.name}'` : `${inserted.count} new listings match '${first.name}'`;
        const message = inserted.count === 1 ? `${first.item} is listed for $${first.price.toFixed(2)}${place ? ` in ${place}` : ""}.` : `Including ${first.item} at $${first.price.toFixed(2)}${place ? ` in ${place}` : ""}.`;
        await tx.notification.create({ data: { userId: first.userId, savedSearchId, type: "NEW_LISTING_MATCH", title, message, href: savedSearchUrl(criteria(first)) } });
        return inserted.count;
      });
      if (outcome) summary.triggered++;
    } catch {
      summary.errors++;
      console.error("[saved-search]", JSON.stringify({ savedSearchId, operation: "evaluate", timestamp: now.toISOString(), context: "saved search evaluation failed" }));
    }
  }
  return summary;
}
