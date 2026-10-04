import { prisma } from "@/lib/prisma";
import { requireAdmin } from "./auth";

export const periods = [7, 30, 90, 365] as const;
export function parsePeriod(value?: string) {
  const days = Number(value);
  return periods.find(period => period === days) ?? 30;
}

export async function getOverview(days: number) {
  await requireAdmin();
  const end = new Date();
  const start = new Date(end);
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - days + 1);
  const previous = new Date(start.getTime() - days * 86400000);
  const [users, listings, sellers, pendingReports, newUsers, priorUsers, newListings, priorListings, recentUsers, recentListings, categories, growth] = await Promise.all([
    prisma.user.count(),
    prisma.product.count(),
    prisma.user.count({ where: { listings: { some: {} } } }),
    Promise.all([prisma.messageReport.count({ where: { resolved: false } }), prisma.safetyReport.count({ where: { status: "OPEN" } })]).then(([legacy, safety]) => legacy + safety),
    prisma.user.count({ where: { createdAt: { gte: start, lte: end } } }),
    prisma.user.count({ where: { createdAt: { gte: previous, lt: start } } }),
    prisma.product.count({ where: { createdAt: { gte: start, lte: end } } }),
    prisma.product.count({ where: { createdAt: { gte: previous, lt: start } } }),
    prisma.user.findMany({ orderBy: { createdAt: "desc" }, take: 6, select: { id: true, name: true, createdAt: true } }),
    prisma.product.findMany({ orderBy: { createdAt: "desc" }, take: 6, select: { id: true, item: true, createdAt: true, owner: { select: { name: true } } } }),
    prisma.product.groupBy({ by: ["category"], _count: { id: true }, orderBy: { _count: { id: "desc" } }, take: 8 }),
    prisma.$queryRaw<Array<{ day: string; users: number; listings: number }>>`
      SELECT to_char(day, 'YYYY-MM-DD') AS day,
        sum(users)::int AS users, sum(listings)::int AS listings
      FROM (
        SELECT date_trunc('day', "createdAt") AS day, count(*) AS users, 0 AS listings
        FROM "User" WHERE "createdAt" >= ${start} AND "createdAt" <= ${end} GROUP BY 1
        UNION ALL
        SELECT date_trunc('day', "createdAt") AS day, 0 AS users, count(*) AS listings
        FROM "Product" WHERE "createdAt" >= ${start} AND "createdAt" <= ${end} GROUP BY 1
      ) counts GROUP BY day ORDER BY day`,
  ]);
  const bucketDays = Math.ceil(days / 12);
  const buckets = Array.from({ length: Math.ceil(days / bucketDays) }, (_, index) => ({
    date: new Date(start.getTime() + index * bucketDays * 86400000).toISOString().slice(0, 10), users: 0, listings: 0,
  }));
  for (const row of growth) {
    const index = Math.floor((new Date(row.day).getTime() - start.getTime()) / (bucketDays * 86400000));
    if (buckets[index]) { buckets[index].users += row.users; buckets[index].listings += row.listings; }
  }
  const activity = [
    ...recentUsers.map(user => ({ id: "user-" + user.id, event: "Account registered", subject: user.name, createdAt: user.createdAt })),
    ...recentListings.map(listing => ({ id: "listing-" + listing.id, event: "Listing published", subject: `${listing.item} · ${listing.owner.name}`, createdAt: listing.createdAt })),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 8);
  return { users, listings, sellers, pendingReports, newUsers, priorUsers, newListings, priorListings, categories, buckets, activity };
}
