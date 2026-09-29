CREATE TYPE "PriceWatchCondition" AS ENUM ('BELOW', 'ABOVE', 'PERCENT_DROP', 'PERCENT_RISE');
CREATE TYPE "NotificationType" AS ENUM ('PRICE_ALERT');

CREATE TABLE "PriceWatch" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "commodity" "Commodity" NOT NULL,
  "variety" "CommodityVariety",
  "grade" "SellerGrade",
  "normalizedUnit" "ListingUnit" NOT NULL,
  "country" TEXT,
  "location" TEXT,
  "cohortKey" TEXT NOT NULL,
  "condition" "PriceWatchCondition" NOT NULL,
  "threshold" DECIMAL(30,12) NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "lastConditionMet" BOOLEAN,
  "lastValue" DECIMAL(30,12),
  "lastEvaluatedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PriceWatch_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PriceWatch_threshold_check" CHECK ("threshold" > 0)
);

CREATE TABLE "Notification" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "watchId" TEXT,
  "type" "NotificationType" NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "href" TEXT,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NotificationPreference" (
  "userId" TEXT NOT NULL,
  "inAppPriceAlerts" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("userId")
);

CREATE UNIQUE INDEX "PriceWatch_userId_cohortKey_condition_threshold_key" ON "PriceWatch"("userId", "cohortKey", "condition", "threshold");
CREATE INDEX "PriceWatch_enabled_id_idx" ON "PriceWatch"("enabled", "id");
CREATE INDEX "PriceWatch_userId_createdAt_idx" ON "PriceWatch"("userId", "createdAt");
CREATE INDEX "Notification_userId_readAt_createdAt_idx" ON "Notification"("userId", "readAt", "createdAt");
CREATE INDEX "Notification_watchId_createdAt_idx" ON "Notification"("watchId", "createdAt");

ALTER TABLE "PriceWatch" ADD CONSTRAINT "PriceWatch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_watchId_fkey" FOREIGN KEY ("watchId") REFERENCES "PriceWatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
