CREATE TABLE "PriceSnapshot" (
  "id" TEXT NOT NULL,
  "productId" TEXT,
  "productKey" TEXT NOT NULL,
  "commodity" "Commodity" NOT NULL,
  "variety" "CommodityVariety",
  "grade" "SellerGrade",
  "normalizedUnit" "ListingUnit" NOT NULL,
  "normalizedPrice" DECIMAL(30,12) NOT NULL,
  "category" TEXT NOT NULL,
  "country" TEXT,
  "location" TEXT,
  "stateHash" TEXT NOT NULL,
  "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PriceSnapshot_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "PriceSnapshot" ADD CONSTRAINT "PriceSnapshot_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PriceSnapshot" ADD CONSTRAINT "PriceSnapshot_price_check"
  CHECK ("normalizedPrice" > 0);

CREATE INDEX "PriceSnapshot_capturedAt_idx" ON "PriceSnapshot"("capturedAt");
CREATE INDEX "PriceSnapshot_commodity_idx" ON "PriceSnapshot"("commodity");
CREATE INDEX "PriceSnapshot_normalizedUnit_idx" ON "PriceSnapshot"("normalizedUnit");
CREATE INDEX "PriceSnapshot_country_location_idx" ON "PriceSnapshot"("country", "location");
CREATE INDEX "PriceSnapshot_productKey_capturedAt_idx" ON "PriceSnapshot"("productKey", "capturedAt");
CREATE INDEX "PriceSnapshot_cohort_capturedAt_idx" ON "PriceSnapshot"("commodity", "variety", "grade", "normalizedUnit", "capturedAt");
