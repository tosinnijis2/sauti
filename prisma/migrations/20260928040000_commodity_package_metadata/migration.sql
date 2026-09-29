CREATE TYPE "Commodity" AS ENUM ('MAIZE', 'RICE', 'BEANS', 'WHEAT', 'CASSAVA', 'POTATOES', 'TOMATOES', 'ONIONS', 'BANANAS', 'COFFEE');
CREATE TYPE "CommodityVariety" AS ENUM ('WHITE', 'YELLOW', 'BASMATI', 'LONG_GRAIN');
CREATE TYPE "SellerGrade" AS ENUM ('GRADE_1', 'GRADE_2', 'STANDARD');

ALTER TABLE "Product"
ADD COLUMN "commodity" "Commodity",
ADD COLUMN "variety" "CommodityVariety",
ADD COLUMN "grade" "SellerGrade",
ADD COLUMN "packageQuantity" DECIMAL(12,3),
ADD COLUMN "packageUnit" "ListingUnit";

ALTER TABLE "Product" ADD CONSTRAINT "Product_commodity_attributes_check" CHECK (
  ("commodity" IS NOT NULL OR ("variety" IS NULL AND "grade" IS NULL)) AND
  ("variety" IS NULL OR
    ("commodity" = 'MAIZE' AND "variety" IN ('WHITE', 'YELLOW')) OR
    ("commodity" = 'RICE' AND "variety" IN ('BASMATI', 'LONG_GRAIN')))
);
ALTER TABLE "Product" ADD CONSTRAINT "Product_package_contents_check" CHECK (
  ("packageQuantity" IS NULL AND "packageUnit" IS NULL) OR
  ("packageQuantity" IS NOT NULL AND "packageUnit" IS NOT NULL AND
   "quantity" IS NOT NULL AND "unit" IS NOT NULL AND
   "unit" IN ('BAG', 'SACK', 'BOX', 'CRATE', 'BUNDLE') AND
   "packageUnit" IN ('G', 'KG', 'TONNE', 'ML', 'LITRE', 'ITEM') AND
   "packageQuantity" > 0 AND "packageQuantity" <= 999999999.999)
);
