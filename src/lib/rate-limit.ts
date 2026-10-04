import "server-only";
import { prisma } from "./prisma";

export async function consumeRateLimit(scope: string, subject: string, limit: number, windowMs: number, now = new Date()) {
  const key = `${scope}:${subject}`.slice(0, 240);
  const expiresAt = new Date(now.getTime() + windowMs);
  const rows = await prisma.$queryRaw<Array<{ count: number }>>`
    INSERT INTO "RateLimitBucket" ("key", "count", "windowStart", "expiresAt")
    VALUES (${key}, 1, ${now}, ${expiresAt})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimitBucket"."expiresAt" <= ${now} THEN 1 ELSE "RateLimitBucket"."count" + 1 END,
      "windowStart" = CASE WHEN "RateLimitBucket"."expiresAt" <= ${now} THEN ${now} ELSE "RateLimitBucket"."windowStart" END,
      "expiresAt" = CASE WHEN "RateLimitBucket"."expiresAt" <= ${now} THEN ${expiresAt} ELSE "RateLimitBucket"."expiresAt" END
    RETURNING "count"`;
  return (rows[0]?.count ?? limit + 1) <= limit;
}

export async function pruneExpiredRateLimits(now = new Date()) {
  return prisma.rateLimitBucket.deleteMany({ where: { expiresAt: { lt: now } } });
}
