ALTER TYPE "NotificationType" ADD VALUE 'NEW_LISTING_MATCH';

CREATE TABLE "SavedSearch" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "q" TEXT NOT NULL DEFAULT '',
  "category" TEXT,
  "commodity" "Commodity",
  "variety" "CommodityVariety",
  "grade" "SellerGrade",
  "country" TEXT,
  "location" TEXT,
  "unit" "ListingUnit",
  "minPrice" DECIMAL(12,2),
  "maxPrice" DECIMAL(12,2),
  "sort" TEXT NOT NULL DEFAULT 'relevance',
  "queryCountryCodes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "canonicalKey" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "lastEvaluatedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SavedSearch_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SavedSearch_price_range_check" CHECK ("minPrice" IS NULL OR "maxPrice" IS NULL OR "minPrice" <= "maxPrice")
);

CREATE TABLE "SavedSearchMatch" (
  "savedSearchId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "firstMatchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SavedSearchMatch_pkey" PRIMARY KEY ("savedSearchId", "productId")
);

ALTER TABLE "Notification" ADD COLUMN "savedSearchId" TEXT;

CREATE UNIQUE INDEX "SavedSearch_userId_canonicalKey_key" ON "SavedSearch"("userId", "canonicalKey");
CREATE INDEX "SavedSearch_enabled_id_idx" ON "SavedSearch"("enabled", "id");
CREATE INDEX "SavedSearch_userId_createdAt_idx" ON "SavedSearch"("userId", "createdAt");
CREATE INDEX "SavedSearchMatch_productId_idx" ON "SavedSearchMatch"("productId");
CREATE INDEX "Notification_savedSearchId_createdAt_idx" ON "Notification"("savedSearchId", "createdAt");

ALTER TABLE "SavedSearch" ADD CONSTRAINT "SavedSearch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SavedSearchMatch" ADD CONSTRAINT "SavedSearchMatch_savedSearchId_fkey" FOREIGN KEY ("savedSearchId") REFERENCES "SavedSearch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SavedSearchMatch" ADD CONSTRAINT "SavedSearchMatch_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_savedSearchId_fkey" FOREIGN KEY ("savedSearchId") REFERENCES "SavedSearch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
